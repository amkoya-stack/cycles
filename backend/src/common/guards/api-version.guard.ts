import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { API_VERSION_KEY } from '../decorators/api-version.decorator';

/**
 * API Version Guard
 * 
 * Enforces API versioning by:
 * 1. Extracting version from URL path (/api/v1/..., /api/v2/...)
 * 2. Checking if controller/endpoint matches the requested version
 * 3. Blocking access to mismatched versions
 * 4. Adding version headers to responses
 */
@Injectable()
export class ApiVersionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const handler = context.getHandler();
    const controller = context.getClass();

    // Get version from URL path (e.g., /api/v1/users -> v1)
    const pathVersion = this.extractVersionFromPath(request.path);

    // Get version from controller metadata
    const controllerVersion =
      this.reflector.get<string>(API_VERSION_KEY, controller) || 'v1';

    // If no version in path, default to v1
    const requestedVersion = pathVersion || 'v1';

    // Check if controller version matches requested version
    if (controllerVersion !== requestedVersion) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          message: `API version ${requestedVersion} not found for this endpoint`,
          availableVersions: [controllerVersion],
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // Add version headers to response
    const response = context.switchToHttp().getResponse();
    response.setHeader('API-Version', controllerVersion);
    response.setHeader('X-API-Version', controllerVersion);

    return true;
  }

  /**
   * Extract version from URL path
   * Supports formats: /api/v1/..., /v1/..., /api/v2/...
   */
  private extractVersionFromPath(path: string): string | null {
    // Match /api/v1/ or /v1/ patterns
    const versionMatch = path.match(/\/(?:api\/)?(v\d+)\//);
    return versionMatch ? versionMatch[1] : null;
  }
}

