import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/jwt.strategy';
import { RealtimeService } from './realtime.service';

interface AuthedSocket extends Socket {
  userId?: string;
}

/**
 * Socket.IO gateway. Clients connect with a JWT in the handshake auth payload
 * ({ auth: { token } }). On connect we verify it, join the user's personal room,
 * and let them subscribe to job rooms they participate in. Authorization for job
 * rooms is intentionally light here (membership is also enforced by the REST
 * layer); tighten with a per-job participant check before production.
 */
@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger('RealtimeGateway');

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.setServer(server);
    this.logger.log('Realtime gateway initialized on /realtime');
  }

  async handleConnection(client: AuthedSocket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.headers.authorization?.replace('Bearer ', '') ?? '');
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-access-secret-change-me',
      });
      client.userId = payload.sub;
      await client.join(`user:${payload.sub}`);
    } catch {
      // Reject unauthenticated sockets.
      client.disconnect(true);
    }
  }

  @SubscribeMessage('job:subscribe')
  async subscribeJob(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { jobId: string },
  ): Promise<{ ok: boolean }> {
    if (!client.userId || !body?.jobId) return { ok: false };
    await client.join(`job:${body.jobId}`);
    return { ok: true };
  }

  @SubscribeMessage('job:unsubscribe')
  async unsubscribeJob(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { jobId: string },
  ): Promise<{ ok: boolean }> {
    if (body?.jobId) await client.leave(`job:${body.jobId}`);
    return { ok: true };
  }
}
