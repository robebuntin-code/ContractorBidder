'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function StackHeader({ title }: { title: string }) {
  const router = useRouter();

  return (
    <header className="stack-header">
      <button type="button" className="stack-back" onClick={() => router.back()}>
        ‹ Back
      </button>
      <h1 className="stack-title">{title}</h1>
      <span className="stack-spacer" aria-hidden />
    </header>
  );
}

export function StackHeaderLink({ title, href }: { title: string; href: string }) {
  return (
    <header className="stack-header">
      <Link href={href} className="stack-back">
        ‹ Back
      </Link>
      <h1 className="stack-title">{title}</h1>
      <span className="stack-spacer" aria-hidden />
    </header>
  );
}
