import { IsIn, IsString, Matches, MaxLength } from 'class-validator';

export const ALLOWED_UPLOAD_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;

export class SignUploadDto {
  @IsIn(ALLOWED_UPLOAD_CONTENT_TYPES, {
    message: `contentType must be one of: ${ALLOWED_UPLOAD_CONTENT_TYPES.join(', ')}`,
  })
  contentType!: (typeof ALLOWED_UPLOAD_CONTENT_TYPES)[number];

  // Basic filename hygiene: no path separators, reasonable length.
  @IsString()
  @MaxLength(200)
  @Matches(/^[\w.\- ]+$/, {
    message: 'fileName may only contain letters, numbers, spaces, dots, hyphens, underscores',
  })
  fileName!: string;
}
