import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { verifyPassword, hashPassword } from '@common/utils/hash.util';
import { Role } from '@common/enums';

export interface ValidatedUser {
  id: string;
  email: string;
  workspaceId: string;
  role: string;
  fullName: string;
  avatarUrl: string | null;
}

function mapToSystemRole(profileRole: string): string {
  const map: Record<string, string> = {
    SUPER_ADMIN: Role.SUPER_ADMIN, super_admin: Role.SUPER_ADMIN,
    ADMIN: Role.ADMIN, admin: Role.ADMIN,
    HR: Role.HR, hr: Role.HR,
    TEAM_LEAD: Role.TEAM_LEAD, team_lead: Role.TEAM_LEAD, manager: Role.TEAM_LEAD,
    EMPLOYEE: Role.EMPLOYEE, employee: Role.EMPLOYEE,
    rep: Role.EMPLOYEE, content_creator: Role.EMPLOYEE, viewer: Role.EMPLOYEE,
  };
  return map[profileRole] ?? Role.EMPLOYEE;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Validates email + password against Supabase auth.users. Returns null on failure. */
  async validateCredentials(email: string, password: string): Promise<ValidatedUser | null> {
    const user = await this.prisma.users.findFirst({
      where: { email: { equals: email.toLowerCase().trim() } },
      select: { id: true, email: true, encrypted_password: true, deleted_at: true },
    });

    if (!user || user.deleted_at || !user.encrypted_password) return null;

    const isValid = await verifyPassword(password, user.encrypted_password);
    if (!isValid) return null;

    const profile = await this.prisma.profiles.findFirst({
      where: { user_id: user.id },
      select: { workspace_id: true, role: true, full_name: true, avatar_url: true },
    });

    if (!profile?.workspace_id) return null;

    return {
      id: user.id,
      email: user.email ?? email,
      workspaceId: profile.workspace_id,
      role: mapToSystemRole(profile.role),
      fullName: profile.full_name,
      avatarUrl: profile.avatar_url ?? null,
    };
  }

  async findById(userId: string) {
    const profile = await this.prisma.profiles.findFirst({
      where: { user_id: userId },
      include: {
        workspaces: { select: { id: true, name: true, slug: true, logo_url: true } },
      },
    });
    if (!profile) throw new NotFoundException('User not found');
    return profile;
  }

  async findByEmail(email: string) {
    return this.prisma.users.findFirst({
      where: { email: { equals: email.toLowerCase().trim() } },
      select: { id: true, email: true },
    });
  }

  async updateProfile(userId: string, data: { full_name?: string; avatar_url?: string }) {
    return this.prisma.profiles.update({
      where: { user_id: userId },
      data: {
        ...(data.full_name !== undefined && { full_name: data.full_name }),
        ...(data.avatar_url !== undefined && { avatar_url: data.avatar_url }),
      },
    });
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const hashed = await hashPassword(newPassword);
    await this.prisma.users.update({
      where: { id: userId },
      data: { encrypted_password: hashed, updated_at: new Date() },
    });
  }

  async getEncryptedPassword(userId: string): Promise<string | null> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { encrypted_password: true },
    });
    return user?.encrypted_password ?? null;
  }
}
