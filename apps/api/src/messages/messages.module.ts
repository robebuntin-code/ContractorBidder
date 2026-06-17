import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [MediaModule],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
