import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class MarkReadDto {
  // If omitted, marks all of the caller's unread notifications as read.
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  ids?: string[];
}
