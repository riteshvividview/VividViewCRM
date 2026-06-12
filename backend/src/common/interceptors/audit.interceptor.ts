import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AUDIT_KEY } from '../constants';
import { AuditMetadata } from '../decorators';
import { AuthenticatedUser } from '../decorators';

export interface AuditContext {
  action: string;
  module: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  isSensitive?: boolean;
}

/**
 * Reads @Audit() metadata and writes an audit log entry after a successful response.
 * Services can enrich the context by setting req._auditContext and req._auditBefore.
 * Writes are async (fire-and-forget via BullMQ) — does not block the response.
 *
 * Extension point: inject AuditService when the audit module is built.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditMeta = this.reflector.getAllAndOverride<AuditMetadata | undefined>(
      AUDIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!auditMeta) return next.handle();

    const request = context
      .switchToHttp()
      .getRequest<
        Request & {
          user?: AuthenticatedUser;
          requestId?: string;
          _auditContext?: AuditContext;
          _auditBefore?: unknown;
        }
      >();

    return next.handle().pipe(
      tap({
        next: () => {
          // Merge decorator-level metadata with service-enriched context
          const ctx: AuditContext = {
            ...auditMeta,
            ...(request._auditContext ?? {}),
          };

          // TODO: inject AuditService and call auditService.enqueue(ctx)
          // when the audit infrastructure module is wired.
          // The structure is intentionally decoupled so the audit module
          // can be added in Phase 1 without touching this interceptor.
          void ctx; // suppress unused warning until service is wired
        },
      }),
    );
  }
}
