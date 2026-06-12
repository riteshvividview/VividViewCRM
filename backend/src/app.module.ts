import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Config
import { AppConfigModule } from './config/config.module';
import { AppConfigService } from './config/config.service';

// Database
import { PrismaModule } from './database/prisma.module';

// Infrastructure
import { RedisModule } from './infrastructure/redis/redis.module';
import { BullInfraModule } from './infrastructure/bull/bull.module';
import { LoggerModule } from './infrastructure/logger/logger.module';
import { StorageModule } from './infrastructure/storage/storage.module';

// WebSocket
import { WebSocketModule } from './websocket/websocket.module';

// Domain modules
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { HrmsModule } from './modules/hrms/hrms.module';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { CrmModule } from './modules/crm/crm.module';
import { SharedJwtModule } from './shared/jwt/jwt.module';

// Common
import { GlobalExceptionFilter } from './common/filters';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { WINSTON_LOGGER } from './common/constants';

/**
 * Request ID middleware — attaches a UUID to every request for distributed tracing.
 * Set before all guards and interceptors run.
 */
function requestIdMiddleware(req: Request & { requestId?: string }, _res: Response, next: NextFunction): void {
  req.requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
  _res.setHeader('X-Request-ID', req.requestId);
  next();
}

@Module({
  imports: [
    // ── Foundation (order matters: Config first, then dependent modules) ──
    AppConfigModule,
    LoggerModule,
    PrismaModule,
    RedisModule,
    BullInfraModule,
    StorageModule,
    SharedJwtModule,
    WebSocketModule,

    // ── Rate limiting ─────────────────────────────────────────────────────
    ThrottlerModule.forRootAsync({
      useFactory: (config: AppConfigService) => ({
        throttlers: [
          {
            name: 'global',
            ttl: 60_000, // 1 minute window
            limit: config.rateLimitPerMinute,
          },
        ],
        // NOTE: Use Redis storage in production for distributed rate limiting.
        // When @nestjs/throttler-storage-redis is available, inject it here.
        // For now, in-memory store is fine for single-instance development.
      }),
      inject: [AppConfigService],
    }),

    // ── Feature modules ───────────────────────────────────────────────────
    HealthModule,
    AuthModule,
    TasksModule,
    HrmsModule,
    InvoiceModule,
    CrmModule,

    // Future modules plug in here:
    // AuthModule, UsersModule, WorkspaceModule,
    // CrmModule, HrmsModule, InvoiceModule,
    // NotificationsModule, DocumentsModule, ApprovalsModule, ReportsModule
  ],

  providers: [
    // ── Global exception filter ───────────────────────────────────────────
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },

    // ── Global guards (applied in order) ─────────────────────────────────
    // JwtAuthGuard: validates Bearer token on every route (use @Public() to opt-out)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // RolesGuard: checks @Roles() decorator after auth is confirmed
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // ThrottlerGuard: rate limiting (applied after auth, so throttle is per-user)
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    // ── Global interceptors (applied in order) ────────────────────────────
    // LoggingInterceptor: request/response logging
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    // AuditInterceptor: reads @Audit() metadata, enqueues audit entries
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    // ResponseInterceptor: wraps responses in { success, statusCode, data, timestamp }
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Apply request ID middleware to ALL routes
    consumer
      .apply(requestIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
