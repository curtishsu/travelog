import Link from 'next/link';

import { SignInForm } from '@/features/auth/components/sign-in-form';

export default function SignInPage() {
  return (
    <div className="mx-auto max-w-md space-y-6 rounded-3xl border border-slate-800 bg-slate-900/40 p-8">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-white">Welcome back</h1>
        <p className="text-sm text-slate-400">Sign in to continue journaling your travels.</p>
      </header>
      <SignInForm />
      <p className="text-center text-xs text-slate-400">
        No account yet?{' '}
        <Link href="/auth/signup" className="text-brand underline-offset-4 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}

