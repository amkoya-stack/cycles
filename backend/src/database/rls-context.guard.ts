import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from './database.service';

/**
 * RLS Context Guard
 * 
 * Ensures that Row Level Security (RLS) context is properly set before
 * executing queries that access RLS-protected tables.
 * 
 * This guard can be applied to controllers or routes that need RLS context.
 * It automatically sets system context for public routes or user context
 * for authenticated routes.
 */
@Injectable()
export class RlsContextGuard implements CanActivate {
  private readonly logger = new Logger(RlsContextGuard.name);

  constructor(private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    try {
      if (userId) {
        // Authenticated route - set user context
        await this.db.setUserContext(userId);
        this.logger.debug(`Set user context for user: ${userId}`);
      } else {
        // Public route - set system context to bypass RLS
        await this.db.setSystemContext();
        this.logger.debug('Set system context for public route');
      }
      return true;
    } catch (error) {
      this.logger.error('Failed to set RLS context', error);
      // Don't block the request, but log the error
      return true;
    }
  }
}

