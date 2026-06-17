import Image from 'next/image';

type BrandLogoSize = 'nav' | 'hero';

const SIZES: Record<BrandLogoSize, { width: number; height: number; className: string }> = {
  nav: { width: 120, height: 48, className: 'brand-logo brand-logo-nav' },
  hero: { width: 240, height: 96, className: 'brand-logo brand-logo-hero' },
};

export default function BrandLogo({ size = 'nav' }: { size?: BrandLogoSize }) {
  const { width, height, className } = SIZES[size];

  return (
    <Image
      src="/logo.png"
      alt="DOJOBID"
      width={width}
      height={height}
      className={className}
      priority={size === 'nav'}
    />
  );
}
