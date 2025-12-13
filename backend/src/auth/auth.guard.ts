import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class HeaderAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const userId = req.headers['x-user-id'] as string | undefined;
    if (!userId) {
      throw new UnauthorizedException(
        'x-user-id header required for this operation',
      );
    }
    req.user = { id: userId };
    return true;
  }
}
