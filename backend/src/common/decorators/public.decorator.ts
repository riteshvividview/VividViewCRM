import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants';

/**
 * Mark a route as public — JwtAuthGuard will skip token validation.
 * Usage: @Public() on controller method or class.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
