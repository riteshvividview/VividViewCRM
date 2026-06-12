import { ValidationPipe as NestValidationPipe } from '@nestjs/common';

/**
 * Pre-configured global validation pipe.
 * - whitelist: strips unknown properties (prevents mass assignment)
 * - forbidNonWhitelisted: rejects requests with unexpected fields
 * - transform: auto-casts query params/body to their TS types
 * - transformOptions.enableImplicitConversion: false (explicit types only)
 */
export const createValidationPipe = () =>
  new NestValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: false,
    },
  });
