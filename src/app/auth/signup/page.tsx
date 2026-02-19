import Link from 'next/link';

import { SignUpForm } from '@/features/auth/components/sign-up-form';

export default function SignUpPage() {
  return (
    <div className="mx-auto max-w-md space-y-6 rounded-3xl border border-slate-800 bg-slate-900/40 p-8">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-white">Create your account</h1>
        <p className="text-sm text-slate-400">
          Travelog keeps every trip in one place. You may need to confirm your email before signing in.
        </p>
      </header>
      <SignUpForm />
      <p className="text-center text-xs text-slate-400">
        Already have an account?{' '}
        <Link href="/auth/signin" className="text-brand underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

