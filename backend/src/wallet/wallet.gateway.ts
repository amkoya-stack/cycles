import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  },
  namespace: '/wallet',
})
export class WalletGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WalletGateway.name);
  private userSockets = new Map<string, Set<string>>(); // userId -> Set of socket IDs

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (!userId) {
      this.logger.warn(`Client ${client.id} connected without userId`);
      client.disconnect();
      return;
    }

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(client.id);

    this.logger.log(
      `Client ${client.id} connected for user ${userId}. Total connections: ${this.userSockets.get(userId)!.size}`,
    );
  }

  handleDisconnect(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId && this.userSockets.has(userId)) {
      this.userSockets.get(userId)!.delete(client.id);
      if (this.userSockets.get(userId)!.size === 0) {
        this.userSockets.delete(userId);
      }
      this.logger.log(`Client ${client.id} disconnected for user ${userId}`);
    }
  }

  /**
   * Emit balance update to all connected clients of a user
   */
  emitBalanceUpdate(userId: string, newBalance: string) {
    const socketIds = this.userSockets.get(userId);
    if (socketIds && socketIds.size > 0) {
      socketIds.forEach((socketId) => {
        this.server.to(socketId).emit('balanceUpdated', {
          balance: newBalance,
          timestamp: new Date().toISOString(),
        });
      });
      this.logger.log(
        `Emitted balance update to ${socketIds.size} sockets for user ${userId}`,
      );
    }
  }

  /**
   * Emit transaction notification to user
   */
  emitTransactionNotification(
    userId: string,
    transaction: {
      id: string;
      type: string;
      amount: string;
      status: string;
    },
  ) {
    const socketIds = this.userSockets.get(userId);
    if (socketIds && socketIds.size > 0) {
      socketIds.forEach((socketId) => {
        this.server.to(socketId).emit('transactionUpdate', {
          transaction,
          timestamp: new Date().toISOString(),
        });
      });
      this.logger.log(`Emitted transaction notification to user ${userId}`);
    }
  }

  /**
   * Emit deposit status update (for M-Pesa polling replacement)
   */
  emitDepositStatusUpdate(
    userId: string,
    checkoutRequestId: string,
    status: string,
  ) {
    const socketIds = this.userSockets.get(userId);
    if (socketIds && socketIds.size > 0) {
      socketIds.forEach((socketId) => {
        this.server.to(socketId).emit('depositStatusUpdate', {
          checkoutRequestId,
          status,
          timestamp: new Date().toISOString(),
        });
      });
      this.logger.log(
        `Emitted deposit status update to user ${userId}: ${status}`,
      );
    }
  }
}
