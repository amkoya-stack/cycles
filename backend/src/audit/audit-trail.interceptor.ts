import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditTrailService } from './audit-trail.service';

/**
 * Interceptor to automatically log API requests to audit trail
 */
@Injectable()
export class AuditTrailInterceptor implements NestInterceptor {
  constructor(private readonly auditTrail: AuditTrailService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const handler = context.getHandler();
    const controller = context.getClass();

    // Skip audit for certain endpoints (health checks, etc.)
    const skipAudit = ['/health', '/metrics'].some((path) =>
      request.url.startsWith(path),
    );

    if (skipAudit) {
      return next.handle();
    }

    const startTime = Date.now();
    const userId = request.user?.id;
    const ipAddress = request.ip || request.headers['x-forwarded-for'];
    const userAgent = request.headers['user-agent'];
    const deviceFingerprint = request.headers['x-device-fingerprint'];
    const sessionId = request.headers['x-session-id'];

    // Determine if compliance logging is required
    const complianceRequired = this.isComplianceRequired(
      request.method,
      request.url,
    );

    return next.handle().pipe(
      tap({
        next: async (data) => {
          const duration = Date.now() - startTime;

          // Log successful request
          try {
            await this.auditTrail.logActivity(
              `${request.method} ${request.url}`,
              'api_request',
              null, // No specific entity ID for general API requests
              {
                userId,
                ipAddress,
                userAgent,
                deviceFingerprint,
                sessionId,
                complianceRequired,
              },
              {
                method: request.method,
                url: request.url,
                statusCode: response.statusCode,
                duration,
                controller: controller.name,
                handler: handler.name,
              },
            );
          } catch (error) {
            // Don't fail the request if audit logging fails
            console.error('Failed to log audit trail:', error);
          }
        },
        error: async (error) => {
          const duration = Date.now() - startTime;

          // Log failed request
          try {
            await this.auditTrail.logActivity(
              `${request.method} ${request.url} - ERROR`,
              'api_request',
              null, // No specific entity ID for general API requests
              {
                userId,
                ipAddress,
                userAgent,
                deviceFingerprint,
                sessionId,
                complianceRequired: true, // Always log errors for compliance
              },
              {
                method: request.method,
                url: request.url,
                statusCode: error.status || 500,
                duration,
                error: error.message,
                controller: controller.name,
                handler: handler.name,
              },
            );
          } catch (auditError) {
            console.error('Failed to log audit trail for error:', auditError);
          }
        },
      }),
    );
  }

  /**
   * Determine if compliance logging is required for this endpoint
   */
  private isComplianceRequired(method: string, url: string): boolean {
    // Financial operations always require compliance logging
    if (url.includes('/wallet') || url.includes('/transaction')) {
      return true;
    }

    // Admin operations
    if (url.includes('/admin')) {
      return true;
    }

    // KYC operations
    if (url.includes('/kyc')) {
      return true;
    }

    // AML operations
    if (url.includes('/aml')) {
      return true;
    }

    // GDPR operations
    if (url.includes('/gdpr')) {
      return true;
    }

    // Write operations (POST, PUT, DELETE)
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      return true;
    }

    return false;
  }
}

