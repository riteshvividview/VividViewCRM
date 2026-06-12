import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from '@config/config.service';
import { RedisService } from '@infrastructure/redis/redis.service';
import { AuthenticatedUser } from '@common/decorators/current-user.decorator';

export interface JwtPayload {
  sub: string;
  workspaceId: string;
  email: string;
  role: string;
  tokenVersion: number;
  sessionId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: AppConfigService,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwtAccessSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Check global token version — incremented on logout-all to invalidate all old access tokens
    const stored = await this.redis.get(`token_version:${payload.sub}`);
    const currentVersion = stored ? parseInt(stored, 10) : 0;
    if (payload.tokenVersion < currentVersion) {
      throw new UnauthorizedException('Session has been invalidated');
    }

    return {
      id: payload.sub,
      workspaceId: payload.workspaceId,
      email: payload.email,
      role: payload.role,
      tokenVersion: payload.tokenVersion,
      sessionId: payload.sessionId,
    };
  }
}
