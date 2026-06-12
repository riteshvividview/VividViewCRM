import { NestFactory, Reflector } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';
import { createValidationPipe } from './common/pipes/validation.pipe';
import { WINSTON_LOGGER } from './common/constants';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  // ── Create application ─────────────────────────────────────────────────
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true, // buffer logs until Winston logger is ready
  });

  const config = app.get(AppConfigService);

  // ── Use Winston as the application logger ──────────────────────────────
  try {
    const winstonLogger = app.get(WINSTON_LOGGER);
    app.useLogger(winstonLogger);
  } catch {
    logger.warn('Winston logger not available — using default NestJS logger');
  }

  // ── Trust proxy (required when behind Cloudflare / Railway / Vercel) ──
  app.set('trust proxy', 1);

  // ── Security middleware ────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'wss:'],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31_536_000,
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hidePoweredBy: true,
    }),
  );

  // ── Compression ────────────────────────────────────────────────────────
  app.use(compression());

  // ── Cookie parser ──────────────────────────────────────────────────────
  app.use(cookieParser());

  // ── CORS ──────────────────────────────────────────────────────────────
  const allowedOrigins = [config.frontendUrl];
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: true,
    maxAge: 86_400,
  });

  // ── Global prefix and versioning ───────────────────────────────────────
  app.setGlobalPrefix(config.apiPrefix);

  // ── Global validation pipe ─────────────────────────────────────────────
  app.useGlobalPipes(createValidationPipe());

  // ── WebSocket adapter ──────────────────────────────────────────────────
  app.useWebSocketAdapter(new IoAdapter(app));

  // ── Swagger API documentation ──────────────────────────────────────────
  if (config.featureSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('VividCRM API')
      .setDescription(
        'Enterprise CRM + Task Management + HRMS + Invoice platform. ' +
        'All endpoints require a valid JWT Bearer token unless marked as Public.',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'JWT',
      )
      .addCookieAuth(config.refreshCookieName)
      .addTag('Health', 'System health and readiness probes')
      .addTag('Auth', 'Authentication — login, refresh, logout, password management')
      .addTag('Users', 'User account management (SUPER_ADMIN)')
      .addTag('Workspace', 'Workspace configuration')
      .addTag('CRM — Leads', 'Lead pipeline management')
      .addTag('CRM — Deals', 'Deal pipeline management')
      .addTag('CRM — Contacts', 'Contact records')
      .addTag('CRM — Companies', 'Company records')
      .addTag('CRM — Campaigns', 'Marketing campaigns')
      .addTag('CRM — Mailing', 'Email broadcasts')
      .addTag('CRM — Reports', 'CRM analytics')
      .addTag('Tasks — Projects', 'Project management')
      .addTag('Tasks — Boards', 'Kanban board management')
      .addTag('Tasks — Tasks', 'Task management')
      .addTag('Tasks — Time Entries', 'Time tracking')
      .addTag('Tasks — Sprints', 'Sprint management')
      .addTag('HRMS — Employees', 'Employee management')
      .addTag('HRMS — Attendance', 'Attendance and clock management')
      .addTag('HRMS — Leaves', 'Leave management')
      .addTag('HRMS — Payroll', 'Payroll processing')
      .addTag('Invoices', 'Invoice management')
      .addTag('Notifications', 'Notification management')
      .addTag('Documents', 'Document management')
      .addServer(
        `http://localhost:${config.port}`,
        'Local development',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });

    logger.log(`Swagger UI: http://localhost:${config.port}/api/docs`);
  }

  // ── Start server ───────────────────────────────────────────────────────
  const port = config.port;
  await app.listen(port);

  logger.log(`🚀 VividCRM API running on http://localhost:${port}`);
  logger.log(`   Environment : ${config.nodeEnv}`);
  logger.log(`   API prefix  : /${config.apiPrefix}`);
  logger.log(`   WebSocket   : ws://localhost:${port}/notifications`);

  if (config.featureSwagger) {
    logger.log(`   Swagger     : http://localhost:${port}/api/docs`);
  }
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
