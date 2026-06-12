import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: NestConfigService) {}

  // ── Application ─────────────────────────────────────────────
  get nodeEnv(): string {
    return this.config.get<string>('NODE_ENV', 'development');
  }

  get port(): number {
    return this.config.get<number>('PORT', 3001);
  }

  get apiPrefix(): string {
    return this.config.get<string>('API_PREFIX', 'api/v1');
  }

  get frontendUrl(): string {
    return this.config.getOrThrow<string>('FRONTEND_URL');
  }

  get internalApiSecret(): string {
    return this.config.getOrThrow<string>('INTERNAL_API_SECRET');
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  // ── Database ────────────────────────────────────────────────
  get databaseUrl(): string {
    return this.config.getOrThrow<string>('DATABASE_URL');
  }

  get databaseDirectUrl(): string | undefined {
    return this.config.get<string>('DATABASE_DIRECT_URL');
  }

  get databaseQueryLog(): boolean {
    return this.config.get<boolean>('DATABASE_QUERY_LOG', false);
  }

  // ── Redis ───────────────────────────────────────────────────
  get redisUrl(): string {
    return this.config.getOrThrow<string>('REDIS_URL');
  }

  get redisKeyPrefix(): string {
    return this.config.get<string>('REDIS_KEY_PREFIX', 'dev');
  }

  // ── JWT ─────────────────────────────────────────────────────
  get jwtAccessSecret(): string {
    return this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  get jwtRefreshSecret(): string {
    return this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  get jwtAccessExpiresIn(): number {
    return this.config.get<number>('JWT_ACCESS_EXPIRES_IN', 900);
  }

  get jwtRefreshExpiresIn(): number {
    return this.config.get<number>('JWT_REFRESH_EXPIRES_IN', 604800);
  }

  get refreshCookieName(): string {
    return this.config.get<string>('REFRESH_COOKIE_NAME', 'vcrm_rt');
  }

  // ── File Storage ────────────────────────────────────────────
  // TODO: Switch r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2BucketName, r2Endpoint back
  // to getOrThrow() when implementing file uploads. Currently optional so the app starts without R2.
  get r2AccountId(): string {
    return this.config.get<string>('R2_ACCOUNT_ID', '');
  }

  get r2AccessKeyId(): string {
    return this.config.get<string>('R2_ACCESS_KEY_ID', '');
  }

  get r2SecretAccessKey(): string {
    return this.config.get<string>('R2_SECRET_ACCESS_KEY', '');
  }

  get r2BucketName(): string {
    return this.config.get<string>('R2_BUCKET_NAME', '');
  }

  get r2PublicUrl(): string {
    return this.config.get<string>('R2_PUBLIC_URL', '');
  }

  get r2Endpoint(): string {
    return this.config.get<string>('R2_ENDPOINT', '');
  }

  get r2SignedUrlExpiry(): number {
    return this.config.get<number>('R2_SIGNED_URL_EXPIRY', 300);
  }

  /** True only when all required R2 credentials are present and non-empty. */
  get r2IsConfigured(): boolean {
    return Boolean(
      this.r2AccountId &&
        this.r2AccessKeyId &&
        this.r2SecretAccessKey &&
        this.r2BucketName &&
        this.r2Endpoint,
    );
  }

  // ── Email ───────────────────────────────────────────────────
  get brevoApiKey(): string {
    return this.config.getOrThrow<string>('BREVO_API_KEY');
  }

  get brevoFromEmail(): string {
    return this.config.getOrThrow<string>('BREVO_FROM_EMAIL');
  }

  get brevoFromName(): string {
    return this.config.get<string>('BREVO_FROM_NAME', 'VividCRM');
  }

  get smtpHost(): string {
    return this.config.get<string>('SMTP_HOST', 'localhost');
  }

  get smtpPort(): number {
    return this.config.get<number>('SMTP_PORT', 1025);
  }

  get useBrevoApi(): boolean {
    return this.config.get<boolean>('SMTP_USE_BREVO_API', false);
  }

  // ── Encryption ──────────────────────────────────────────────
  get dataEncryptionKey(): string {
    return this.config.getOrThrow<string>('DATA_ENCRYPTION_KEY');
  }

  // ── BullMQ ──────────────────────────────────────────────────
  get queueMaxAttempts(): number {
    return this.config.get<number>('QUEUE_MAX_ATTEMPTS', 3);
  }

  get queueBackoffDelay(): number {
    return this.config.get<number>('QUEUE_BACKOFF_DELAY', 5000);
  }

  get bullBoardUsername(): string {
    return this.config.get<string>('BULL_BOARD_USERNAME', 'admin');
  }

  get bullBoardPassword(): string {
    return this.config.getOrThrow<string>('BULL_BOARD_PASSWORD');
  }

  // ── Rate Limiting ───────────────────────────────────────────
  get rateLimitPerMinute(): number {
    return this.config.get<number>('RATE_LIMIT_PER_MINUTE', 100);
  }

  get rateLimitPublicPerMinute(): number {
    return this.config.get<number>('RATE_LIMIT_PUBLIC_PER_MINUTE', 20);
  }

  get rateLimitExportPerHour(): number {
    return this.config.get<number>('RATE_LIMIT_EXPORT_PER_HOUR', 5);
  }

  // ── PDF ─────────────────────────────────────────────────────
  get chromiumPath(): string {
    return this.config.get<string>('CHROMIUM_PATH', '');
  }

  get pdfConcurrency(): number {
    return this.config.get<number>('PDF_CONCURRENCY', 3);
  }

  // ── Sentry ──────────────────────────────────────────────────
  get sentryDsn(): string {
    return this.config.get<string>('SENTRY_DSN', '');
  }

  get sentryEnvironment(): string {
    return this.config.get<string>('SENTRY_ENVIRONMENT', 'development');
  }

  get sentryRelease(): string {
    return this.config.get<string>('SENTRY_RELEASE', 'local');
  }

  get sentryTracesSampleRate(): number {
    return this.config.get<number>('SENTRY_TRACES_SAMPLE_RATE', 0.1);
  }

  // ── Logging ─────────────────────────────────────────────────
  get logLevel(): string {
    return this.config.get<string>('LOG_LEVEL', 'debug');
  }

  get logFormat(): string {
    return this.config.get<string>('LOG_FORMAT', 'pretty');
  }

  get logHttpRequests(): boolean {
    return this.config.get<boolean>('LOG_HTTP_REQUESTS', true);
  }

  // ── Feature Flags ───────────────────────────────────────────
  get featurePublicSignup(): boolean {
    return this.config.get<boolean>('FEATURE_PUBLIC_SIGNUP', false);
  }

  get featureSwagger(): boolean {
    return this.config.get<boolean>('FEATURE_SWAGGER', true);
  }

  get featureBullBoard(): boolean {
    return this.config.get<boolean>('FEATURE_BULL_BOARD', true);
  }

  get featureDetailedErrors(): boolean {
    return this.config.get<boolean>('FEATURE_DETAILED_ERRORS', true);
  }

  get maxFileSize(): number {
    return this.config.get<number>('MAX_FILE_SIZE', 10_485_760);
  }

  // ── Supabase ────────────────────────────────────────────────
  get supabaseUrl(): string {
    return this.config.get<string>('SUPABASE_URL', '');
  }

  get supabaseAnonKey(): string {
    return this.config.get<string>('SUPABASE_ANON_KEY', '');
  }

  get supabaseServiceRoleKey(): string {
    return this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY', '');
  }
}
