import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType | null = null;
  private isConnected = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisHost = this.configService.get<string>('REDIS_HOST');
    const redisPort = this.configService.get<string>('REDIS_PORT');

    // Skip Redis if not configured
    if (!redisHost || !redisPort || redisPort === '') {
      this.logger.warn('⚠️ Redis not configured - running without cache');
      return;
    }

    try {
      this.client = createClient({
        socket: {
          host: redisHost,
          port: parseInt(redisPort, 10),
        },
      });

      this.client.on('error', (err) =>
        this.logger.error('Redis Client Error', err),
      );
      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log('✅ Redis connected successfully');
      });

      await this.client.connect();
    } catch (error) {
      this.logger.warn(
        '⚠️ Redis connection failed - running without cache',
        error,
      );
      this.client = null;
    }
  }

  async onModuleDestroy() {
    if (this.client && this.isConnected) {
      await this.client.quit();
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    return await this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.client) return;
    if (ttl) {
      await this.client.setEx(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;
    return (await this.client.exists(key)) === 1;
  }

  async incr(key: string): Promise<number> {
    if (!this.client) return 0;
    return await this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.client) return false;
    const result = await this.client.expire(key, seconds);
    return result === 1;
  }

  getClient(): RedisClientType | null {
    return this.client;
  }

  async ping(): Promise<string> {
    if (!this.client) return 'PONG (no redis)';
    return await this.client.ping();
  }
}
