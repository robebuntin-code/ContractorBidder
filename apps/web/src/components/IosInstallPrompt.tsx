'use client';

import { useEffect, useState } from 'react';

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return isIosDevice() && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

export default function IosInstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isIosSafari() && !isStandalone());
  }, []);

  if (!show) return null;

  return (
    <aside className="ios-install-prompt" aria-label="Add DOJOBID to your home screen">
      <p className="ios-install-prompt-title">Add DOJOBID to your home screen</p>
      <p className="ios-install-prompt-lead">
        You opened this page in Safari. Finish install with two taps:
      </p>
      <ol className="ios-install-prompt-steps">
        <li>
          Tap <strong>Share</strong> <span className="ios-share-icon" aria-hidden="true">⎋</span> at the bottom of
          Safari.
        </li>
        <li>
          Tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
        </li>
      </ol>
      <p className="ios-install-prompt-note">
        Apple requires these steps — a QR code opens this page, then you confirm install here.
      </p>
    </aside>
  );
}
