import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '../generated/prisma/client';
import { hash as argonHash, verify as argonVerify, Algorithm } from '@node-rs/argon2';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './jwt.strategy';
import { LoginDto, RegisterDto } from './dto/auth.dto';

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  isVerified: boolean;
  createdAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_TAKEN',
        message: 'An account with this email already exists.',
      });
    }

    const passwordHash = await argonHash(dto.password, { algorithm: Algorithm.Argon2id });
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: dto.role,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        tosAcceptedAt: new Date(),
      },
    });

    return this.issueSession(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }
    const ok = await argonVerify(user.passwordHash, dto.password);
    if (!ok) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }
    if (user.isBanned) {
      throw new ForbiddenException({
        code: 'ACCOUNT_BANNED',
        message: 'This account has been suspended.',
      });
    }
    return this.issueSession(user);
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or expired.',
      });
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'User no longer exists.' });
    }
    return this.issueSession(user);
  }

  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
    };
  }

  private async issueSession(user: User) {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '900s',
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_TTL') ?? '30d',
      }),
    ]);
    return { accessToken, refreshToken, user: this.toPublicUser(user) };
  }
}
