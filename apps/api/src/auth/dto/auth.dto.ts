import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '../../generated/prisma/client';

const SIGNUP_ROLES = [Role.HOMEOWNER, Role.CONTRACTOR] as const;

export class RegisterDto {
  @IsEmail()
  email!: string;

  // At least 8 chars, with a letter and a number.
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'password must contain at least one letter and one number',
  })
  password!: string;

  @IsEnum(SIGNUP_ROLES, { message: 'role must be HOMEOWNER or CONTRACTOR' })
  role!: (typeof SIGNUP_ROLES)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}
