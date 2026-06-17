import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { WORK_TYPES } from './job.dto';

export class JobDescriptionSuggestionsDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsString()
  @IsIn(WORK_TYPES)
  workType!: (typeof WORK_TYPES)[number];

  @IsString()
  @MaxLength(4000)
  description!: string;
}
