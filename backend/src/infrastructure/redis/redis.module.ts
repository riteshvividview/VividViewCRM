import { Global, Module } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppConfigService } from '@config/config.service';
import { REDIS_CLIENT } from '@common/constants';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: AppConfigService): Redis => {
        const client = new Redis(config.redisUrl, {
          keyPrefix: `${config.redisKeyPrefix}:`,
          maxRetriesPerRequest: 3,
          retryStrategy: (times: number) => {
            if (times > 10) return null; // stop retrying after 10 attempts
            return Math.min(times * 100, 3000); // exponential back-off up to 3 s
          },
          enableReadyCheck: true,
          lazyConnect: false,
        });
        return client;
      },
      inject: [AppConfigService],
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
