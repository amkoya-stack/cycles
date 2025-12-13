import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyJwt } from './jwt.util';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers['authorization'] as string | undefined;
    if (!auth || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token required');
    }
    const token = auth.slice('Bearer '.length);
    const secret = this.config.get<string>('JWT_SECRET') || 'dev-secret';
    const res = verifyJwt(token, secret);
    if (!res.valid || !res.payload?.sub) {
      throw new UnauthorizedException('Invalid token');
    }
    req.user = { id: res.payload.sub };
    return true;
  }
}
