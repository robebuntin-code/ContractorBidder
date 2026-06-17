import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { ContractorsController } from './contractors.controller';
import { ContractorsService } from './contractors.service';

@Module({
  imports: [MediaModule],
  controllers: [ContractorsController],
  providers: [ContractorsService],
})
export class ContractorsModule {}
