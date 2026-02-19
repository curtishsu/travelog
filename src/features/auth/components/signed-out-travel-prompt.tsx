'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

type SignedOutTravelPromptProps = {
  heading: string;
  body: string;
};

const previewSlides = [
  { src: '/TravelogScreen.png', alt: 'Travelog preview showing Peru trip with map pins' },
  { src: '/TravelogScreenAltHQ1.png', alt: 'Travelog preview showing Europe trip with map pins' },
  { src: '/TravelogScreenAltHQ2.png', alt: 'Travelog preview showing Southeast Asia trip with map pins' },
  { src: '/TravelogScreenAltHQ3.png', alt: 'Travelog preview showing North America trip with map pins' }
];

const SWIPE_THRESHOLD = 40;

function shuffleSlides(slides: typeof previewSlides) {
  const next = [...slides];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = next[index];
    next[index] = next[swapIndex];
    next[swapIndex] = current;
  }
  return next;
}

export function SignedOutTravelPrompt({ heading, body }: SignedOutTravelPromptProps) {
  const [slides, setSlides] = useState(previewSlides);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const didSwipeRef = useRef(false);

  useEffect(() => {
    const randomizedSlides = shuffleSlides(previewSlides);
    setSlides(randomizedSlides);
    setActiveSlideIndex(Math.floor(Math.random() * randomizedSlides.length));
  }, []);

  function goToPrevious() {
    setActiveSlideIndex((prev) => (prev - 1 + slides.length) % slides.length);
  }

  function goToNext() {
    setActiveSlideIndex((prev) => (prev + 1) % slides.length);
  }

  function handleSwipe(startX: number, endX: number) {
    const delta = endX - startX;
    if (Math.abs(delta) < SWIPE_THRESHOLD) {
      didSwipeRef.current = false;
      return;
    }
    didSwipeRef.current = true;
    if (delta < 0) {
      goToNext();
      return;
    }
    goToPrevious();
  }

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5 text-center sm:p-6">
      <div
        className="mx-auto w-full max-w-[220px] overflow-hidden rounded-3xl border border-sky-300/40 shadow-[0_0_36px_rgba(56,189,248,0.14)]"
        onTouchStart={(event) => {
          touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const startX = touchStartXRef.current;
          const endX = event.changedTouches[0]?.clientX ?? null;
          if (typeof startX === 'number' && typeof endX === 'number') {
            handleSwipe(startX, endX);
          }
          touchStartXRef.current = null;
        }}
        onClick={(event) => {
          if (didSwipeRef.current) {
            didSwipeRef.current = false;
            return;
          }
          const rect = event.currentTarget.getBoundingClientRect();
          const clickOffsetX = event.clientX - rect.left;
          if (clickOffsetX < rect.width / 2) {
            goToPrevious();
            return;
          }
          goToNext();
        }}
      >
        <Image
          src={slides[activeSlideIndex].src}
          alt={slides[activeSlideIndex].alt}
          width={688}
          height={1000}
          className="h-auto w-full"
          priority
        />
      </div>
      <h3 className="mt-4 text-xl font-semibold text-white">{heading}</h3>
      <p className="mt-2 text-sm text-slate-300">{body}</p>
      <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
        <Button asChild size="sm">
          <Link href="/auth/signin">Sign in</Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link href="/auth/signup">Sign up</Link>
        </Button>
      </div>
    </div>
  );
}
