import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '../generated/prisma/client';
import { AuthUser } from '../common/decorators/current-user.decorator';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-access-secret-change-me',
    });
  }

  /** Return value is attached to request.user. */
  validate(payload: JwtPayload): AuthUser {
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
