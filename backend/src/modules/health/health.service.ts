import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { RedisService } from '@infrastructure/redis/redis.service';
import { StorageService } from '@infrastructure/storage/storage.service';
import { AppConfigService } from '@config/config.service';

interface CheckResult {
  status: 'ok' | 'error' | 'not_configured';
  latencyMs?: number;
  error?: string;
}

export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  checks: {
    database: CheckResult;
    redis: CheckResult;
    storage: CheckResult;
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
    private readonly config: AppConfigService,
  ) {}

  async check(): Promise<HealthCheckResult> {
    const [database, redis, storage] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkStorage(),
    ]);

    const checks = {
      database: database.status === 'fulfilled' ? database.value : { status: 'error' as const, error: String(database.reason) },
      redis: redis.status === 'fulfilled' ? redis.value : { status: 'error' as const, error: String(redis.reason) },
      storage: storage.status === 'fulfilled' ? storage.value : { status: 'error' as const, error: String(storage.reason) },
    };

    // not_configured is not treated as an error — it means the service is intentionally disabled.
    // TODO: Remove the not_configured exclusion when R2 is configured (file uploads implemented).
    const criticalChecks = Object.values(checks).filter((c) => c.status !== 'not_configured');
    const allOk = criticalChecks.every((c) => c.status === 'ok');
    const anyOk = criticalChecks.some((c) => c.status === 'ok');
    const status = allOk ? 'ok' : anyOk ? 'degraded' : 'down';

    return {
      status,
      timestamp: new Date().toISOString(),
      version: process.env['npm_package_version'] ?? '0.0.0',
      environment: this.config.nodeEnv,
      uptime: Math.floor(process.uptime()),
      checks,
    };
  }

  private async checkDatabase(): Promise<CheckResult> {
    const start = Date.now();
    const ok = await this.prisma.ping();
    return ok
      ? { status: 'ok', latencyMs: Date.now() - start }
      : { status: 'error', error: 'Database ping failed' };
  }

  private async checkRedis(): Promise<CheckResult> {
    const start = Date.now();
    const ok = await this.redis.ping();
    return ok
      ? { status: 'ok', latencyMs: Date.now() - start }
      : { status: 'error', error: 'Redis ping failed' };
  }

  private checkStorage(): CheckResult {
    // TODO: Change not_configured → error check when R2 is implemented, so missing credentials
    // are caught by health monitoring in production.
    return this.storage.isConfigured()
      ? { status: 'ok' }
      : { status: 'not_configured', error: 'R2 storage disabled — set R2_* env vars to enable' };
  }
}
