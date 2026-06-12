import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../constants';
import { Role } from '../enums';

/**
 * Restrict a route to specific roles.
 * Usage: @Roles(Role.ADMIN, Role.SUPER_ADMIN)
 * Multiple roles are OR-ed — any one match grants access.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
