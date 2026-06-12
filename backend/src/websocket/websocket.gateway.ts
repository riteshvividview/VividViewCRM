import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { WebSocketService } from './websocket.service';
import { WS_CLOSE_CODES, WS_MAX_CONNECTIONS_PER_USER } from '@common/constants';
import { AppConfigService } from '@config/config.service';
import { RedisService } from '@infrastructure/redis/redis.service';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    workspaceId: string;
    role: string;
  };
}

interface JwtPayload {
  sub: string;
  workspaceId: string;
  role: string;
  tokenVersion: number;
  sessionId: string;
}

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
      callback(null, true);
    },
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly wsService: WebSocketService,
    private readonly redis: RedisService,
    private readonly config: AppConfigService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit(server: Server): void {
    this.wsService.setServer(server);
    this.logger.log('WebSocket gateway initialised at /notifications');
  }

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const token =
        (client.handshake.auth as { token?: string }).token ??
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Connection refused (no token): ${client.id}`);
        client.disconnect(true);
        return;
      }

      // Full JWT verification using JwtService (AuthModule is now wired)
      let payload: JwtPayload;
      try {
        payload = this.jwtService.verify<JwtPayload>(token, {
          secret: this.config.jwtAccessSecret,
        });
      } catch {
        client.emit('error', { message: 'Invalid or expired token' });
        client.disconnect(true);
        return;
      }

      if (!payload.sub || !payload.workspaceId) {
        client.disconnect(true);
        return;
      }

      // Check token version for logout-all support
      const storedVersion = await this.redis.get(`token_version:${payload.sub}`);
      const currentVersion = storedVersion ? parseInt(storedVersion, 10) : 0;
      if (payload.tokenVersion < currentVersion) {
        client.emit('error', { message: 'Session invalidated' });
        client.disconnect(true);
        return;
      }

      // ── Connection limit per user ─────────────────────────────────────
      const connKey = `ws:connections:${payload.sub}`;
      const connCount = await this.redis.incr(connKey);
      await this.redis.expire(connKey, 86400);

      if (connCount > WS_MAX_CONNECTIONS_PER_USER) {
        await this.redis.incrby(connKey, -1);
        client.emit('error', { code: WS_CLOSE_CODES.TOO_MANY_CONNECTIONS });
        client.disconnect(true);
        return;
      }

      // ── Set socket data ───────────────────────────────────────────────
      client.data = {
        userId: payload.sub,
        workspaceId: payload.workspaceId,
        role: payload.role,
      };

      // ── Join rooms ────────────────────────────────────────────────────
      await client.join(`user:${payload.sub}`);
      await client.join(`workspace:${payload.workspaceId}`);

      // ── Mark online ───────────────────────────────────────────────────
      await this.redis.sadd(`online:${payload.workspaceId}`, payload.sub);

      this.logger.log(`Client connected: ${client.id} (user:${payload.sub})`);
    } catch (err) {
      this.logger.error(`Connection error: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    const { userId, workspaceId } = client.data ?? {};
    if (!userId || !workspaceId) return;

    const connKey = `ws:connections:${userId}`;
    const remaining = await this.redis.incrby(connKey, -1);
    if (remaining <= 0) {
      await this.redis.del(connKey);
      await this.redis.srem(`online:${workspaceId}`, userId);
    }

    this.logger.log(`Client disconnected: ${client.id} (user:${userId})`);
  }

  // ── Client → Server events ────────────────────────────────────────────────────

  @SubscribeMessage('board.subscribe')
  async handleBoardSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { boardId: string },
  ): Promise<void> {
    if (!data?.boardId) return;
    await client.join(`board:${data.boardId}`);
  }

  @SubscribeMessage('board.unsubscribe')
  async handleBoardUnsubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { boardId: string },
  ): Promise<void> {
    if (!data?.boardId) return;
    await client.leave(`board:${data.boardId}`);
  }

  @SubscribeMessage('notification.mark_read')
  handleMarkRead(
    @ConnectedSocket() _client: AuthenticatedSocket,
    @MessageBody() _data: { notificationId: string },
  ): void {
    // TODO: call NotificationsService.markRead() when module is wired
  }

  @SubscribeMessage('presence.update')
  async handlePresence(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { status: 'online' | 'away' | 'offline' },
  ): Promise<void> {
    const { userId, workspaceId } = client.data ?? {};
    if (!userId || !workspaceId) return;

    this.wsService.emitToWorkspace(workspaceId, 'presence.changed', {
      userId,
      status: data.status,
      updatedAt: new Date().toISOString(),
    });
  }
}
