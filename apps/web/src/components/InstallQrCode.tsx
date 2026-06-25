import QRCode from 'qrcode';
import { getInstallPageUrl } from '@/lib/siteUrl';

type InstallQrCodeProps = {
  size?: number;
  label?: string;
};

export default async function InstallQrCode({ size = 200, label }: InstallQrCodeProps) {
  const installUrl = getInstallPageUrl();
  const dataUrl = await QRCode.toDataURL(installUrl, {
    width: size,
    margin: 1,
    color: { dark: '#0f172a', light: '#ffffff' },
  });

  return (
    <figure className="install-qr">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt={`QR code to open ${installUrl} on your iPhone`}
        width={size}
        height={size}
        className="install-qr-image"
      />
      {label ? <figcaption className="install-qr-label">{label}</figcaption> : null}
    </figure>
  );
}
