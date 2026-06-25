import { IsString, MaxLength, MinLength } from 'class-validator';

export class JobPhotoEditDto {
  /** Stable object key from a prior upload (uploads/{userId}/…). */
  @IsString()
  @MinLength(10)
  @MaxLength(512)
  sourceKey!: string;

  /** Natural-language edit instructions, e.g. landscaping changes. */
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  prompt!: string;
}
