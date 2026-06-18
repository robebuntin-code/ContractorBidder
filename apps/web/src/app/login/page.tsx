'use client';



import Link from 'next/link';

import Image from 'next/image';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import type { Role } from '@contractor-bidder/types';

import { api, tokenStore } from '@/lib/api';

import BrandLogo from '@/components/BrandLogo';
import { HowDojobidWorksLink } from '@/components/HowDojobidWorks';
import { notifyAuthChange, useAuth } from '@/components/AuthProvider';



export default function LoginPage() {

  const router = useRouter();

  const { user, loading } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [email, setEmail] = useState('contractor@example.com');

  const [password, setPassword] = useState('Password123!');

  const [firstName, setFirstName] = useState('');

  const [lastName, setLastName] = useState('');

  const [role, setRole] = useState<Exclude<Role, 'ADMIN'>>('CONTRACTOR');

  const [error, setError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);



  useEffect(() => {

    if (loading || !user) return;

    router.replace(user.role === 'CONTRACTOR' ? '/jobs' : '/my-jobs');

  }, [user, loading, router]);



  async function submit(e: React.FormEvent) {

    e.preventDefault();

    setError(null);

    setBusy(true);

    try {

      const res =

        mode === 'login'

          ? await api.login({ email, password })

          : await api.register({ email, password, firstName, lastName, role });

      tokenStore.set(res);

      notifyAuthChange();

      router.replace(res.user.role === 'CONTRACTOR' ? '/jobs' : '/my-jobs');

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Something went wrong');

    } finally {

      setBusy(false);

    }

  }



  return (

    <div className="hero-grid">

      <div className="hero-panel login-screen">

        <BrandLogo size="hero" />

        <h1 className="hero-headline">

          {mode === 'login' ? 'Get work done' : 'Create your account'}

        </h1>

        <p className="page-subtitle" style={{ marginBottom: 28 }}>

          {mode === 'login'

            ? 'Homeowners post jobs. Contractors bid and get hired — all in one place.'

            : 'Create your account as a homeowner or contractor.'}

        </p>



        <form onSubmit={(e) => void submit(e)} className="login-card">

          {mode === 'register' && (

            <>

              <label htmlFor="firstName">First name</label>

              <input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />

              <label htmlFor="lastName">Last name</label>

              <input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />

              <p className="field-label" style={{ marginTop: 16 }}>

                I am a

              </p>

              <div className="role-row">

                {(['HOMEOWNER', 'CONTRACTOR'] as const).map((r) => (

                  <button

                    key={r}

                    type="button"

                    className={role === r ? 'btn-primary' : 'btn-outline'}

                    onClick={() => setRole(r)}

                  >

                    {r === 'HOMEOWNER' ? 'Homeowner' : 'Contractor'}

                  </button>

                ))}

              </div>

            </>

          )}

          <label htmlFor="email">Email</label>

          <input

            id="email"

            type="email"

            value={email}

            onChange={(e) => setEmail(e.target.value)}

            autoCapitalize="none"

            required

          />

          <label htmlFor="password">Password</label>

          <input

            id="password"

            type="password"

            value={password}

            onChange={(e) => setPassword(e.target.value)}

            required

          />

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn-primary btn-block" disabled={busy} style={{ marginTop: 20 }}>

            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}

          </button>

        </form>



        <button

          type="button"

          className="login-toggle"

          onClick={() => {

            setMode(mode === 'login' ? 'register' : 'login');

            setError(null);

          }}

        >

          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}

        </button>

        <HowDojobidWorksLink className="login-toggle" />

      </div>



      <aside className="promo-card">

        <div className="promo-card-visual">

          <Image

            src="/homeowner-landscaping-promo.png"

            alt="Happy homeowner thanking a landscaping contractor for completed yard work"

            width={640}

            height={360}

            className="promo-card-photo"

            priority

          />

        </div>

        <div className="promo-card-body">

          <p className="promo-card-title">Everything you need to hire — or get hired — near you</p>

          <Link href="/jobs" className="promo-card-btn">

            Browse open jobs

          </Link>

        </div>

      </aside>

    </div>

  );

}

