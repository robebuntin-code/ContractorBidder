import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import InstallQrCode from '@/components/InstallQrCode';
import IosInstallPrompt from '@/components/IosInstallPrompt';
import { getInstallPageUrl } from '@/lib/siteUrl';

export const metadata: Metadata = {
  title: 'Download DOJOBID for iPhone',
  description: 'Install DOJOBID on your iPhone from dojobid.com — add to Home Screen or join the native app beta.',
};

const iosInstallUrl = process.env.NEXT_PUBLIC_IOS_INSTALL_URL?.trim() || '';
const androidInstallUrl = process.env.NEXT_PUBLIC_ANDROID_INSTALL_URL?.trim() || '';
const installPageUrl = getInstallPageUrl();

export default function DownloadPage() {
  return (
    <div className="download-page">
      <IosInstallPrompt />

      <div className="download-hero">
        <BrandLogo size="hero" />
        <h1 className="page-title">Get DOJOBID on your phone</h1>
        <p className="page-subtitle">
          Use DOJOBID on iPhone from your home screen — no App Store required. The same account works on the web
          and mobile.
        </p>
      </div>

      <section className="card download-card download-card-qr">
        <div className="download-qr-layout">
          <InstallQrCode size={220} label="Scan with iPhone Camera" />
          <div>
            <h2 className="download-card-title">Scan to install on iPhone</h2>
            <p className="download-card-lead">
              Point your iPhone Camera at this QR code. It opens{' '}
              <strong>{installPageUrl.replace(/^https:\/\//, '')}</strong> in Safari with install steps.
            </p>
            <ol className="download-steps download-steps-compact">
              <li>Scan the code with your iPhone Camera app.</li>
              <li>Tap the banner to open the link in Safari.</li>
              <li>
                Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section className="card download-card">
        <div className="download-card-header">
          <Image src="/app-icon.png" alt="" width={64} height={64} className="download-app-icon" />
          <div>
            <h2 className="download-card-title">Install on iPhone (recommended)</h2>
            <p className="download-card-lead">
              Add DOJOBID to your home screen in Safari. It opens full-screen like an app and connects to the live
              DOJOBID service.
            </p>
          </div>
        </div>

        <ol className="download-steps">
          <li>
            Open <strong>dojobid.com</strong> in <strong>Safari</strong> on your iPhone.
          </li>
          <li>
            Tap the <strong>Share</strong> button (square with arrow at the bottom of the screen).
          </li>
          <li>
            Scroll down and tap <strong>Add to Home Screen</strong>.
          </li>
          <li>
            Tap <strong>Add</strong>. Open DOJOBID from your home screen and sign in.
          </li>
        </ol>

        <p className="download-note">
          Tip: If you already use DOJOBID in Safari, bookmark this page or share the link with your crew.
        </p>
      </section>

      <section className="card download-card">
        <h2 className="download-card-title">Native iPhone app</h2>
        {iosInstallUrl ? (
          <>
            <p className="download-card-lead">
              Install the native DOJOBID app for push notifications, camera uploads, and maps.
            </p>
            <a href={iosInstallUrl} className="btn btn-primary download-cta" rel="noopener noreferrer">
              Download for iPhone
            </a>
          </>
        ) : (
          <>
            <p className="download-card-lead">
              A native App Store build is in progress. Until it is live, use <strong>Add to Home Screen</strong>{' '}
              above — it is the fastest way to use DOJOBID on iPhone today.
            </p>
            <p className="download-note">
              Apple does not allow direct public IPA downloads from websites. When TestFlight or the App Store link is
              ready, it will appear here automatically.
            </p>
          </>
        )}
      </section>

      {androidInstallUrl ? (
        <section className="card download-card">
          <h2 className="download-card-title">Android</h2>
          <p className="download-card-lead">Install the DOJOBID Android app.</p>
          <a href={androidInstallUrl} className="btn btn-primary download-cta" rel="noopener noreferrer">
            Download for Android
          </a>
        </section>
      ) : null}

      <p className="download-footer">
        Already have an account?{' '}
        <Link href="/login" className="login-toggle">
          Log in on the web
        </Link>
      </p>
    </div>
  );
}
