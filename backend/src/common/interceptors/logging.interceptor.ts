import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  LoggerService,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { WINSTON_LOGGER } from '../constants';
import { AuthenticatedUser } from '../decorators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(WINSTON_LOGGER)
    private readonly logger: LoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request & { requestId?: string; user?: AuthenticatedUser }>();
    const response = ctx.getResponse<Response>();

    // Skip health checks to keep logs clean
    if (request.path === '/health') {
      return next.handle();
    }

    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          this.logger.log(
            JSON.stringify({
              type: 'http_request',
              method: request.method,
              path: request.path,
              statusCode: response.statusCode,
              duration,
              requestId: request.requestId,
              userId: request.user?.id,
              workspaceId: request.user?.workspaceId,
            }),
            'HTTP',
          );
        },
        error: (err: unknown) => {
          const duration = Date.now() - start;
          this.logger.warn(
            JSON.stringify({
              type: 'http_error',
              method: request.method,
              path: request.path,
              statusCode: (err as { status?: number }).status ?? 500,
              duration,
              requestId: request.requestId,
              userId: request.user?.id,
              workspaceId: request.user?.workspaceId,
            }),
            'HTTP',
          );
        },
      }),
    );
  }
}
