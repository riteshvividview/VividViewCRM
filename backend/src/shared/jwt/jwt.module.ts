import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigService } from '@config/config.service';

/**
 * Global JWT module — makes JwtService available everywhere without importing per-module.
 * Imported once in AppModule. WebSocketGateway and AuthModule both inject JwtService directly.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.jwtAccessSecret,
        signOptions: { expiresIn: config.jwtAccessExpiresIn },
      }),
    }),
  ],
  exports: [JwtModule],
})
export class SharedJwtModule {}
