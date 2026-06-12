import { Global, Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import { AppConfigService } from '@config/config.service';
import { WINSTON_LOGGER } from '@common/constants';

const { combine, timestamp, errors, json, colorize, printf, splat } = winston.format;

const prettyFormat = printf(({ level, message, context, timestamp: ts, ...meta }) => {
  const ctx = context ? ` [${context as string}]` : '';
  const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts as string} ${level}${ctx}: ${message as string}${extra}`;
});

@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      useFactory: (config: AppConfigService) => {
        const isPretty = config.logFormat === 'pretty';
        const level = config.logLevel;

        const transports: winston.transport[] = [
          new winston.transports.Console({
            format: isPretty
              ? combine(colorize(), timestamp({ format: 'HH:mm:ss' }), splat(), prettyFormat)
              : combine(timestamp(), errors({ stack: true }), splat(), json()),
          }),
        ];

        // Rotate file logs in non-development environments
        if (!config.isDevelopment) {
          transports.push(
            new winston.transports.DailyRotateFile({
              filename: 'logs/error-%DATE%.log',
              datePattern: 'YYYY-MM-DD',
              level: 'error',
              maxFiles: '30d',
              format: combine(timestamp(), errors({ stack: true }), json()),
            }) as unknown as winston.transport,
            new winston.transports.DailyRotateFile({
              filename: 'logs/combined-%DATE%.log',
              datePattern: 'YYYY-MM-DD',
              maxFiles: '14d',
              format: combine(timestamp(), json()),
            }) as unknown as winston.transport,
          );
        }

        return {
          level,
          transports,
          exitOnError: false,
        };
      },
      inject: [AppConfigService],
    }),
  ],
  exports: [
    // Export the WINSTON_LOGGER token so it can be injected via @Inject(WINSTON_LOGGER)
    {
      provide: WINSTON_LOGGER,
      useExisting: 'winston',
    },
  ],
  providers: [
    {
      provide: WINSTON_LOGGER,
      useExisting: 'winston',
    },
  ],
})
export class LoggerModule {}
