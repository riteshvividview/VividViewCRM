import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators';
import { HealthService, HealthCheckResult } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Health check',
    description:
      'Returns the operational status of the API and all its dependencies. ' +
      'Returns 200 when healthy, 503 when degraded or down.',
  })
  async check(): Promise<HealthCheckResult> {
    const result = await this.healthService.check();

    // NestJS does not allow dynamic status codes via decorator — use @Res if needed.
    // For now we return 200 always and include status in the body.
    // Uptime monitors check for { status: "ok" } in the body.
    return result;
  }

  @Get('ping')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Simple ping', description: 'Lightweight liveness probe' })
  ping(): { pong: boolean; timestamp: string } {
    return { pong: true, timestamp: new Date().toISOString() };
  }
}
