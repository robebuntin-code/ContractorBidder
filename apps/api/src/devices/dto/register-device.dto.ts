import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { DevicePlatform } from '../../generated/prisma/client';

export class RegisterDeviceDto {
  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;

  @IsString()
  @MinLength(10)
  @MaxLength(4096)
  token!: string;
}
