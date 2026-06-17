import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

/**
 * Thin wrapper other services use to push realtime events without depending on
 * the gateway directly. The gateway registers its socket.io `Server` here on
 * init. Rooms:
 *   - `user:<userId>`  — per-user channel (notifications, direct events)
 *   - `job:<jobId>`    — per-job channel (live bids/messages for participants)
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger('Realtime');
  private server?: Server;

  setServer(server: Server): void {
    this.server = server;
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  emitToJob(jobId: string, event: string, payload: unknown): void {
    this.server?.to(`job:${jobId}`).emit(event, payload);
  }
}
