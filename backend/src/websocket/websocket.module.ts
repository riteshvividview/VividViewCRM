import { Global, Module } from '@nestjs/common';
import { NotificationsGateway } from './websocket.gateway';
import { WebSocketService } from './websocket.service';

@Global()
@Module({
  providers: [NotificationsGateway, WebSocketService],
  exports: [WebSocketService],
})
export class WebSocketModule {}
