import {
  Injectable, UnauthorizedException, ConflictException, BadRequestException, Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID, randomBytes } from 'crypto';
import { PrismaService } from '@database/prisma.service';
import { RedisService } from '@infrastructure/redis/redis.service';
import { AppConfigService } from '@config/config.service';
import { sha256, verifyPassword } from '@common/utils/hash.util';
import { UsersService, ValidatedUser } from './users/users.service';
import { MailService } from './mail/mail.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateMeDto } from './dto/update-me.dto';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
}

export interface RefreshPayload {
  sub: string;
  sessionId: string;
  tokenVersion: number;
  type: 'refresh';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: AppConfigService,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
  ) {}

  // ── Login ───────────────────────────────────────────────────────────────────

  async login(user: ValidatedUser): Promise<TokenPair> {
    const sessionId = randomUUID();
    const tokenVersion = await this.getTokenVersion(user.id);
    return this.issueTokens(user, sessionId, tokenVersion);
  }

  // ── Refresh ─────────────────────────────────────────────────────────────────

  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    let payload: RefreshPayload;
    try {
      payload = this.jwtService.verify<RefreshPayload>(rawRefreshToken, {
        secret: this.config.jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid token type');

    const storedHash = await this.redis.get(`rt:${payload.sub}:${payload.sessionId}`);
    if (!storedHash) throw new UnauthorizedException('Session not found — please log in again');

    const incomingHash = sha256(rawRefreshToken);
    if (incomingHash !== storedHash) {
      // Replay detected — invalidate all sessions for this user
      await this.invalidateAllSessions(payload.sub);
      throw new UnauthorizedException('Refresh token reuse detected — all sessions invalidated');
    }

    // Rotate: delete old session
    await this.redis.del(`rt:${payload.sub}:${payload.sessionId}`);

    const profile = await this.usersService.findById(payload.sub);
    const user: ValidatedUser = {
      id: payload.sub,
      email: '',
      workspaceId: profile.workspace_id ?? '',
      role: profile.role,
      fullName: profile.full_name,
      avatarUrl: profile.avatar_url ?? null,
    };

    const currentVersion = await this.getTokenVersion(payload.sub);
    if (payload.tokenVersion < currentVersion) {
      throw new UnauthorizedException('Session has been invalidated');
    }

    // Issue new session ID for rotation
    const newSessionId = randomUUID();
    return this.issueTokens(user, newSessionId, currentVersion);
  }

  // ── Logout ──────────────────────────────────────────────────────────────────

  async logout(userId: string, sessionId: string): Promise<void> {
    await this.redis.del(`rt:${userId}:${sessionId}`);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.invalidateAllSessions(userId);
    await this.redis.incr(`token_version:${userId}`);
  }

  // ── Me ──────────────────────────────────────────────────────────────────────

  async getMe(userId: string) {
    return this.usersService.findById(userId);
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    return this.usersService.updateProfile(userId, dto);
  }

  // ── Change password ─────────────────────────────────────────────────────────

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const currentHash = await this.usersService.getEncryptedPassword(userId);
    if (!currentHash) throw new BadRequestException('Password not set on this account');

    const isValid = await verifyPassword(dto.current_password, currentHash);
    if (!isValid) throw new UnauthorizedException('Current password is incorrect');

    if (dto.current_password === dto.new_password) {
      throw new BadRequestException('New password must differ from current password');
    }

    await this.usersService.updatePassword(userId, dto.new_password);
    // Invalidate all other sessions after password change
    await this.invalidateAllSessions(userId);
    await this.redis.incr(`token_version:${userId}`);
  }

  // ── Forgot / Reset password ─────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    // Always return success even if user not found (prevent email enumeration)
    if (!user) return;

    const profile = await this.prisma.profiles.findFirst({
      where: { user_id: user.id },
      select: { full_name: true },
    });

    const otp = this.generateOtp();
    const otpHash = sha256(otp);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    // Invalidate any existing OTPs for this email
    await this.prisma.otp_verifications.updateMany({
      where: { email: email.toLowerCase(), type: 'password_reset', used_at: null },
      data: { used_at: new Date() },
    });

    await this.prisma.otp_verifications.create({
      data: {
        email: email.toLowerCase(),
        otp_hash: otpHash,
        type: 'password_reset',
        expires_at: expiresAt,
      },
    });

    await this.mailService.sendPasswordResetOtp(
      email,
      otp,
      profile?.full_name ?? 'User',
    );
  }

  async resetPassword(email: string, otp: string, newPassword: string): Promise<void> {
    const otpHash = sha256(otp);
    const record = await this.prisma.otp_verifications.findFirst({
      where: {
        email: email.toLowerCase(),
        otp_hash: otpHash,
        type: 'password_reset',
        used_at: null,
        expires_at: { gt: new Date() },
      },
    });

    if (!record) throw new BadRequestException('Invalid or expired OTP');

    const user = await this.usersService.findByEmail(email);
    if (!user) throw new BadRequestException('User not found');

    await this.usersService.updatePassword(user.id, newPassword);

    // Mark OTP as used
    await this.prisma.otp_verifications.update({
      where: { id: record.id },
      data: { used_at: new Date() },
    });

    // Invalidate all sessions
    await this.invalidateAllSessions(user.id);
    await this.redis.incr(`token_version:${user.id}`);
  }

  // ── Supabase token exchange ─────────────────────────────────────────────────

  async exchangeSupabaseToken(supabaseAccessToken: string): Promise<TokenPair> {
    if (!this.config.supabaseUrl) {
      throw new UnauthorizedException('Supabase integration not configured');
    }

    // Verify the Supabase token by calling Supabase's /auth/v1/user endpoint
    const res = await fetch(`${this.config.supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${supabaseAccessToken}`,
        apikey: this.config.supabaseAnonKey,
      },
    });

    if (!res.ok) {
      throw new UnauthorizedException('Invalid or expired Supabase token');
    }

    const supabaseUser = (await res.json()) as { id: string; email: string };

    // Get the user's profile (workspace + role)
    const profile = await this.prisma.profiles.findFirst({
      where: { user_id: supabaseUser.id },
      select: { workspace_id: true, role: true, full_name: true, avatar_url: true },
    });

    if (!profile?.workspace_id) {
      throw new UnauthorizedException('No workspace profile found for this user');
    }

    const validatedUser: ValidatedUser = {
      id: supabaseUser.id,
      email: supabaseUser.email ?? '',
      workspaceId: profile.workspace_id,
      role: profile.role,
      fullName: profile.full_name,
      avatarUrl: profile.avatar_url ?? null,
    };

    const sessionId = randomUUID();
    const tokenVersion = await this.getTokenVersion(supabaseUser.id);
    return this.issueTokens(validatedUser, sessionId, tokenVersion);
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  private async issueTokens(
    user: ValidatedUser,
    sessionId: string,
    tokenVersion: number,
  ): Promise<TokenPair> {
    const accessPayload = {
      sub: user.id,
      workspaceId: user.workspaceId,
      email: user.email,
      role: user.role,
      tokenVersion,
      sessionId,
    };

    const refreshPayload: RefreshPayload = {
      sub: user.id,
      sessionId,
      tokenVersion,
      type: 'refresh',
    };

    const accessExpiresIn = this.config.jwtAccessExpiresIn;
    const refreshExpiresIn = this.config.jwtRefreshExpiresIn;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.config.jwtAccessSecret,
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.config.jwtRefreshSecret,
        expiresIn: refreshExpiresIn,
      }),
    ]);

    // Store hashed refresh token in Redis
    await this.redis.set(`rt:${user.id}:${sessionId}`, sha256(refreshToken), refreshExpiresIn);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: accessExpiresIn,
      token_type: 'Bearer',
    };
  }

  private async getTokenVersion(userId: string): Promise<number> {
    const stored = await this.redis.get(`token_version:${userId}`);
    return stored ? parseInt(stored, 10) : 0;
  }

  private async invalidateAllSessions(userId: string): Promise<void> {
    await this.redis.invalidatePattern(`rt:${userId}:*`);
  }

  private generateOtp(): string {
    // Cryptographically secure 6-digit OTP
    const buf = randomBytes(3);
    return ((buf.readUInt32BE(0) & 0xffffff) % 900000 + 100000).toString();
  }
}
