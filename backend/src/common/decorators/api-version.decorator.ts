/**
 * API Versioning Decorators
 * 
 * Used to mark controllers and endpoints with their API version
 */

export const API_VERSION_KEY = 'api:version';

/**
 * Decorator to specify the API version for a controller or endpoint
 * 
 * @param version - Version string (e.g., 'v1', 'v2')
 * 
 * @example
 * ```typescript
 * @Controller('users')
 * @ApiVersion('v1')
 * export class UsersController { ... }
 * ```
 */
export function ApiVersion(version: string) {
  return function (target: any) {
    Reflect.defineMetadata(API_VERSION_KEY, version, target);
  };
}

/**
 * Decorator to mark an endpoint as deprecated
 * 
 * @param deprecatedVersion - Version when this endpoint was deprecated
 * @param removalVersion - Optional version when this endpoint will be removed
 * 
 * @example
 * ```typescript
 * @Get('old-endpoint')
 * @Deprecated('v2', 'v3')
 * async oldMethod() { ... }
 * ```
 */
export const DEPRECATED_KEY = 'api:deprecated';

export function Deprecated(
  deprecatedVersion: string,
  removalVersion?: string,
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata(
      DEPRECATED_KEY,
      { deprecatedVersion, removalVersion },
      descriptor.value,
    );
  };
}

