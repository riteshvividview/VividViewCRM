import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AppConfigService } from '@config/config.service';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly config: AppConfigService) {
    super({
      log: config.databaseQueryLog
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ]
        : [
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ],
    });

    if (config.databaseQueryLog) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).$on('query', (e: { query: string; duration: number }) => {
        this.logger.debug(`Query: ${e.query} | Duration: ${e.duration}ms`);
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).$on('error', (e: { message: string }) => {
      this.logger.error(`Prisma error: ${e.message}`);
    });

    this.registerMiddleware();
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Register Prisma middleware.
   *
   * SOFT-DELETE middleware:
   *   Intercepts findMany / findFirst / findUnique and appends
   *   { deletedAt: null } so soft-deleted records are invisible by default.
   *   SUPER_ADMIN routes that need deleted records must pass { includeDeleted: true }
   *   via a custom approach (see shared/repositories/base.repository.ts).
   *
   * WORKSPACE SCOPE middleware:
   *   Injected per-request via AsyncLocalStorage in a future guard.
   *   The stub is here so future modules simply provide the storage value.
   *
   * AUDIT MIDDLEWARE placeholder:
   *   Will be filled when AuditModule is wired in Phase 1.
   */
  private registerMiddleware(): void {
    // ── Soft-delete filter ─────────────────────────────────────────────────
    const softDeleteModels = new Set([
      'Workspace', 'User', 'Team',
      'Lead', 'Deal', 'Contact', 'Company', 'Campaign',
      'Project', 'Board', 'Task', 'TimeEntry',
      'Employee', 'Shift', 'Holiday',
      'SalaryStructure', 'Invoice', 'InvoiceTemplate',
      'Document',
    ]);

    this.$use(async (params, next) => {
      if (!softDeleteModels.has(params.model ?? '')) {
        return next(params);
      }

      // Inject deletedAt filter on read queries
      const readActions = ['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy'];
      if (readActions.includes(params.action)) {
        params.args = params.args ?? {};
        params.args.where = params.args.where ?? {};

        // Allow explicit override via { includeDeleted: true }
        if (!params.args.where['includeDeleted']) {
          params.args.where['deletedAt'] = null;
        }
        // Remove the custom flag before passing to Prisma
        delete params.args.where['includeDeleted'];
      }

      // Convert delete → soft-delete update
      if (params.action === 'delete') {
        params.action = 'update';
        params.args['data'] = { deletedAt: new Date() };
      }

      if (params.action === 'deleteMany') {
        params.action = 'updateMany';
        if (params.args['data'] !== undefined) {
          params.args['data']['deletedAt'] = new Date();
        } else {
          params.args['data'] = { deletedAt: new Date() };
        }
      }

      return next(params);
    });
  }

  /** Ping the database — used by health check */
  async ping(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /** Run a transaction — thin wrapper for readability */
  async transaction<T>(
    fn: (tx: Omit<PrismaService, '$transaction' | '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(fn as Parameters<typeof this.$transaction>[0]) as Promise<T>;
  }
}
