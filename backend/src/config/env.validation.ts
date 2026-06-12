import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // ── Application ──────────────────────────────────────────────
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),
  API_PREFIX: Joi.string().default('api/v1'),
  FRONTEND_URL: Joi.string().uri().required(),
  INTERNAL_API_SECRET: Joi.string().min(32).required(),

  // ── Database ─────────────────────────────────────────────────
  DATABASE_URL: Joi.string().required(),
  DATABASE_DIRECT_URL: Joi.string().optional(),

  // ── Redis ────────────────────────────────────────────────────
  REDIS_URL: Joi.string().required(),
  REDIS_KEY_PREFIX: Joi.string().default('dev'),

  // ── JWT ──────────────────────────────────────────────────────
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .required()
    .custom((value: string, helpers: Joi.CustomHelpers) => {
      const parent = helpers.state.ancestors?.[0] as Record<string, unknown>;
      if (parent && value === parent['JWT_ACCESS_SECRET']) {
        return helpers.error(
          'any.invalid',
          { message: 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET' },
        );
      }
      return value;
    }),
  JWT_ACCESS_EXPIRES_IN: Joi.number().default(900),
  JWT_REFRESH_EXPIRES_IN: Joi.number().default(604800),
  REFRESH_COOKIE_NAME: Joi.string().default('vcrm_rt'),

  // ── File Storage (R2) ─────────────────────────────────────────
  // TODO: Make these required when implementing file uploads (Invoice PDFs, HRMS documents, avatars).
  // All R2 vars are optional until then — StorageService self-disables when unconfigured.
  R2_ACCOUNT_ID: Joi.string().optional().allow(''),
  R2_ACCESS_KEY_ID: Joi.string().optional().allow(''),
  R2_SECRET_ACCESS_KEY: Joi.string().optional().allow(''),
  R2_BUCKET_NAME: Joi.string().optional().allow(''),
  R2_PUBLIC_URL: Joi.string().uri().optional().allow(''),
  R2_ENDPOINT: Joi.string().uri().optional().allow(''),
  R2_SIGNED_URL_EXPIRY: Joi.number().default(300),

  // ── Email (Brevo) ────────────────────────────────────────────
  BREVO_API_KEY: Joi.string().required(),
  BREVO_FROM_EMAIL: Joi.string().email().required(),
  BREVO_FROM_NAME: Joi.string().default('VividCRM'),
  SMTP_HOST: Joi.string().default('localhost'),
  SMTP_PORT: Joi.number().default(1025),
  SMTP_USE_BREVO_API: Joi.boolean().default(false),

  // ── Data Encryption ──────────────────────────────────────────
  DATA_ENCRYPTION_KEY: Joi.string().min(32).required(),

  // ── BullMQ ───────────────────────────────────────────────────
  QUEUE_MAX_ATTEMPTS: Joi.number().default(3),
  QUEUE_BACKOFF_DELAY: Joi.number().default(5000),
  BULL_BOARD_USERNAME: Joi.string().default('admin'),
  BULL_BOARD_PASSWORD: Joi.string().min(8).required(),

  // ── Rate Limiting ────────────────────────────────────────────
  RATE_LIMIT_PER_MINUTE: Joi.number().default(100),
  RATE_LIMIT_PUBLIC_PER_MINUTE: Joi.number().default(20),
  RATE_LIMIT_EXPORT_PER_HOUR: Joi.number().default(5),

  // ── PDF ──────────────────────────────────────────────────────
  CHROMIUM_PATH: Joi.string().optional().allow(''),
  PDF_CONCURRENCY: Joi.number().default(3),

  // ── Sentry ───────────────────────────────────────────────────
  SENTRY_DSN: Joi.string().uri().optional().allow(''),
  SENTRY_ENVIRONMENT: Joi.string().default('development'),
  SENTRY_RELEASE: Joi.string().default('local'),
  SENTRY_TRACES_SAMPLE_RATE: Joi.number().min(0).max(1).default(0.1),

  // ── Logging ──────────────────────────────────────────────────
  LOG_LEVEL: Joi.string()
    .valid('verbose', 'debug', 'log', 'warn', 'error')
    .default('debug'),
  LOG_FORMAT: Joi.string().valid('pretty', 'json').default('pretty'),
  LOG_HTTP_REQUESTS: Joi.boolean().default(true),

  // ── Feature Flags ────────────────────────────────────────────
  FEATURE_PUBLIC_SIGNUP: Joi.boolean().default(false),
  FEATURE_SWAGGER: Joi.boolean().default(true),
  FEATURE_BULL_BOARD: Joi.boolean().default(true),
  FEATURE_DETAILED_ERRORS: Joi.boolean().default(true),
  MAX_FILE_SIZE: Joi.number().default(10_485_760),
  DATABASE_QUERY_LOG: Joi.boolean().default(false),

  // ── Supabase (for auth token exchange) ───────────────────────
  SUPABASE_URL: Joi.string().uri().optional().allow(''),
  SUPABASE_ANON_KEY: Joi.string().optional().allow(''),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().optional().allow(''),
// allowUnknown: true — Windows injects OS variables (PATH, TEMP, APPDATA, etc.) into the process
// environment. Rejecting them with allowUnknown: false causes startup failure on Windows dev machines.
}).options({ allowUnknown: true, abortEarly: false });
