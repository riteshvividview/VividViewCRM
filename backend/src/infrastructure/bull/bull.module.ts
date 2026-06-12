import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppConfigService } from '@config/config.service';
import { QUEUES } from '@common/constants';

/**
 * Registers all BullMQ queues globally.
 * Each queue is defined once here; domain modules import
 * BullModule.registerQueue({ name: QUEUES.X }) to enqueue jobs,
 * and register a @Processor(QUEUES.X) consumer to process them.
 *
 * Default job options:
 *   - attempts: 3 (configurable via env QUEUE_MAX_ATTEMPTS)
 *   - backoff: exponential starting at QUEUE_BACKOFF_DELAY ms
 *   - removeOnComplete: retain last 100 completed jobs
 *   - removeOnFail: false — keep failed jobs for Bull Board inspection
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (config: AppConfigService) => ({
        connection: {
          url: config.redisUrl,
          keyPrefix: `${config.redisKeyPrefix}:bull`,
          maxRetriesPerRequest: null, // required by BullMQ
          enableReadyCheck: false,    // required by BullMQ
        },
        defaultJobOptions: {
          attempts: config.queueMaxAttempts,
          backoff: {
            type: 'exponential',
            delay: config.queueBackoffDelay,
          },
          removeOnComplete: { count: 100 },
          removeOnFail: false,
        },
      }),
      inject: [AppConfigService],
    }),

    // Register all queues up-front so Bull Board can discover them
    BullModule.registerQueue(
      { name: QUEUES.EMAIL_NOTIFICATIONS },
      { name: QUEUES.AUDIT_LOG },
      { name: QUEUES.PDF_GENERATION },
      { name: QUEUES.ATTENDANCE_COMPUTE },
      { name: QUEUES.PAYROLL_COMPUTE },
      { name: QUEUES.RECURRING_TASKS },
      { name: QUEUES.CAMPAIGN_SEND },
      { name: QUEUES.REPORT_GENERATE },
    ),
  ],
  exports: [BullModule],
})
export class BullInfraModule {}
