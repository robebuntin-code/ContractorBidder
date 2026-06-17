import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertContractorProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(140)
  companyName?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  logoUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  businessAddress?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  serviceTypes?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  serviceRadiusKm?: number;

  @IsOptional()
  @IsLatitude()
  @Type(() => Number)
  baseLat?: number;

  @IsOptional()
  @IsLongitude()
  @Type(() => Number)
  baseLng?: number;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  googleReviewsUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  licenseNumber?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  insuranceDocUrl?: string;
}
