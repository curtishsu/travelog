'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import type { TripPhoto } from '@/features/trips/types';

type PhotoGalleryProps = {
  photos: TripPhoto[];
  onDelete?: (photo: TripPhoto) => void;
};

export function PhotoGallery({ photos, onDelete }: PhotoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (!photos.length) {
    return null;
  }

  const isLightboxOpen = activeIndex !== null;
  const activePhoto = activeIndex !== null ? photos[activeIndex] : null;

  function openLightbox(index: number) {
    setActiveIndex(index);
  }

  function closeLightbox() {
    setActiveIndex(null);
  }

  function goNext() {
    if (activeIndex === null) return;
    setActiveIndex((activeIndex + 1) % photos.length);
  }

  function goPrev() {
    if (activeIndex === null) return;
    setActiveIndex((activeIndex - 1 + photos.length) % photos.length);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((photo, index) => (
          <button
            type="button"
            key={photo.id}
            className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 transition hover:border-slate-600"
            onClick={() => openLightbox(index)}
          >
            <Image
              src={photo.thumbnail_url}
              alt="Trip day photo"
              fill
              className="object-cover transition duration-300 group-hover:scale-105"
              sizes="(min-width: 640px) 33vw, 50vw"
            />
          </button>
        ))}
      </div>
      {isLightboxOpen && activePhoto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur">
          <button
            type="button"
            className="absolute right-6 top-6 rounded-full border border-slate-700 bg-slate-900/80 p-2 text-slate-200 hover:text-white"
            onClick={closeLightbox}
            aria-label="Close lightbox"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="absolute left-8 top-1/2 -translate-y-1/2 rounded-full border border-slate-700 bg-slate-900/80 p-3 text-slate-200 hover:text-white"
            onClick={goPrev}
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            className="absolute right-8 top-1/2 -translate-y-1/2 rounded-full border border-slate-700 bg-slate-900/80 p-3 text-slate-200 hover:text-white"
            onClick={goNext}
            aria-label="Next photo"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <div className="relative mx-auto h-[60vh] max-h-[80vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
            <Image
              src={activePhoto.full_url}
              alt="Trip day photo"
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>
          {onDelete ? (
            <Button
              variant="secondary"
              size="sm"
              className="absolute bottom-8 right-8 flex items-center gap-2"
              onClick={() => onDelete(activePhoto)}
            >
              <Trash2 className="h-4 w-4" />
              Delete photo
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

