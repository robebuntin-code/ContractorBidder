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

/** iPhone photos are often HEIC, which many browsers cannot show in <img>. Convert when possible. */
export async function prepareImageFileForUpload(
  file: File,
): Promise<{ file: File; contentType: AllowedImageType }> {
  const contentType = inferImageContentType(file);
  if (contentType !== 'image/heic') {
    return { file, contentType };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');

    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (encoded) => (encoded ? resolve(encoded) : reject(new Error('Could not encode JPEG'))),
        'image/jpeg',
        0.9,
      );
    });

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'logo';
    return {
      file: new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }),
      contentType: 'image/jpeg',
    };
  } catch {
    throw new Error('This photo format is not supported here. Choose a JPEG or PNG logo.');
  }
}
