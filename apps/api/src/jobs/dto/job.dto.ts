import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsISO8601,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { LocationPrecision, Role } from '../../generated/prisma/client';

export const WORK_TYPES = [
  'electrical',
  'plumbing',
  'landscaping',
  'hauling',
  'carpentry',
  'handyman',
  'other',
] as const;

export type WorkType = (typeof WORK_TYPES)[number];

export class CreateJobDto {
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description!: string;

  @IsIn([...WORK_TYPES])
  workType!: WorkType;

  @IsISO8601()
  desiredDatetimeStart!: string;

  @IsOptional()
  @IsISO8601()
  desiredDatetimeEnd?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @IsString()
  @MinLength(3)
  @MaxLength(400)
  addressText!: string;

  @IsOptional()
  @IsString()
  @MinLength(7)
  @MaxLength(30)
  contactPhone?: string;

  @IsLatitude()
  @Type(() => Number)
  lat!: number;

  @IsLongitude()
  @Type(() => Number)
  lng!: number;

  @IsOptional()
  @IsEnum(LocationPrecision)
  locationPrecision?: LocationPrecision;

  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMax?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;
}

export class JobSearchQueryDto {
  @IsOptional()
  @IsIn([...WORK_TYPES])
  workType?: WorkType;

  @IsLatitude()
  @Type(() => Number)
  lat!: number;

  @IsLongitude()
  @Type(() => Number)
  lng!: number;

  @Type(() => Number)
  @Min(0.1)
  @Max(500)
  radiusKm!: number;

  @IsOptional()
  @IsEnum([Role.HOMEOWNER, Role.CONTRACTOR])
  createdByRole?: Role;

  @IsOptional()
  @Type(() => Boolean)
  onlyOpen?: boolean;

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
