import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

/**
 * WebSocket service for emitting events from any NestJS service.
 *
 * Usage in any module:
 *   constructor(private readonly ws: WebSocketService) {}
 *   this.ws.emitToUser(userId, WS_EVENTS.NOTIFICATION_NEW, payload);
 *
 * Room naming convention:
 *   user:{userId}        — per-user room (joined on connect)
 *   workspace:{wsId}     — all users of a workspace
 *   board:{boardId}      — users subscribed to a specific board
 */
@Injectable()
export class WebSocketService {
  private readonly logger = new Logger(WebSocketService.name);
  private server: Server | null = null;

  setServer(server: Server): void {
    this.server = server;
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    if (!this.server) {
      this.logger.warn(`Cannot emit ${event}: Socket.IO server not initialised`);
      return;
    }
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitToWorkspace(workspaceId: string, event: string, data: unknown): void {
    if (!this.server) return;
    this.server.to(`workspace:${workspaceId}`).emit(event, data);
  }

  emitToBoard(boardId: string, event: string, data: unknown): void {
    if (!this.server) return;
    this.server.to(`board:${boardId}`).emit(event, data);
  }

  emitToRoom(room: string, event: string, data: unknown): void {
    if (!this.server) return;
    this.server.to(room).emit(event, data);
  }

  getActiveConnectionCount(): number {
    if (!this.server) return 0;
    return this.server.sockets.sockets.size;
  }
}
