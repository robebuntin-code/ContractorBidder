import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { BidStatus } from '../../generated/prisma/client';

export class CreateBidDto {
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

export class UpdateBidDto {
  // Contractors may only withdraw their own pending bid via this endpoint.
  @IsIn([BidStatus.WITHDRAWN])
  status!: typeof BidStatus.WITHDRAWN;
}
