/** Strip to up to 10 US digits (ignores leading country code 1). */
export function phoneDigits(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('1')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

/** Format as (XXX) XXX-XXXX while typing. */
export function formatPhoneInput(value: string): string {
  const digits = phoneDigits(value);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Display stored phone values consistently. */
export function formatPhoneDisplay(value: string | null | undefined): string {
  if (!value?.trim()) return '';
  const digits = phoneDigits(value);
  if (digits.length === 10) return formatPhoneInput(digits);
  return value.trim();
}

/** Value to persist — formatted when complete, otherwise raw trimmed input. */
export function phoneForStorage(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const digits = phoneDigits(trimmed);
  if (digits.length === 10) return formatPhoneInput(digits);
  return trimmed;
}
