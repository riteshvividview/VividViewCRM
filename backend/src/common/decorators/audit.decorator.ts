import { SetMetadata } from '@nestjs/common';
import { AUDIT_KEY } from '../constants';
import { AuditAction } from '../enums';

export interface AuditMetadata {
  action: AuditAction;
  module: string;
  entityType: string;
  isSensitive?: boolean;
}

/**
 * Annotate a route with audit metadata.
 * The AuditInterceptor reads this and creates an AuditLog entry after the response.
 *
 * Usage:
 *   @Audit({ action: AuditAction.CREATE, module: 'CRM', entityType: 'Lead' })
 */
export const Audit = (metadata: AuditMetadata) => SetMetadata(AUDIT_KEY, metadata);
