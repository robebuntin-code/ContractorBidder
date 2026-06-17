import { IsEnum, IsUUID } from 'class-validator';
import { PaymentDirection } from '../../generated/prisma/client';

export class CreateSessionDto {
  @IsUUID()
  jobId!: string;

  @IsUUID()
  bidId!: string;

  @IsEnum(PaymentDirection)
  direction!: PaymentDirection;
}
