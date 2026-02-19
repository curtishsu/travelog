'use client';

import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

type SignedOutTravelPromptProps = {
  heading: string;
  body: string;
};

export function SignedOutTravelPrompt({ heading, body }: SignedOutTravelPromptProps) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-8 text-center">
      <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full border border-sky-300/40 bg-[radial-gradient(circle_at_30%_30%,rgba(56,189,248,0.25),rgba(15,23,42,0.9)_70%)] shadow-[0_0_50px_rgba(56,189,248,0.16)]">
        <Image
          src="/icon.svg"
          alt="Preview globe"
          width={132}
          height={132}
          className="rounded-3xl border border-slate-700/70"
          priority
        />
      </div>
      <h3 className="mt-6 text-2xl font-semibold text-white">{heading}</h3>
      <p className="mt-3 text-sm text-slate-300">{body}</p>
      <p className="mt-3 text-sm text-slate-400">
        After you sign in and log trips, your globe fills with the places you have visited.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/auth/signin">Sign in</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/auth/signup">Sign up</Link>
        </Button>
      </div>
    </div>
  );
}
