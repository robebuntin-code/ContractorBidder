import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { JobStatus } from '../../generated/prisma/client';

export class AdminJobsQueryDto {
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class AdminUsersQueryDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  banned?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class BanUserDto {
  @IsUUID()
  userId!: string;
}
