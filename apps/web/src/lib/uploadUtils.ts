const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/** Infer a valid upload content-type when the browser omits file.type (common on Windows). */
export function inferImageContentType(file: File): AllowedImageType {
  if (ALLOWED_IMAGE_TYPES.includes(file.type as AllowedImageType)) {
    return file.type as AllowedImageType;
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
    case 'heif':
      return 'image/heic';
    default:
      return 'image/jpeg';
  }
}

export function imageExtensionForContentType(contentType: AllowedImageType): string {
  return contentType.split('/')[1].replace('jpeg', 'jpg');
}
