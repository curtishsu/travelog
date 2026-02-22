'use client';

import { useMemo, useRef, useState } from 'react';

import type { TripDayWithRelations } from '@/features/trips/types';

type TripStoriesCarouselProps = {
  days: TripDayWithRelations[];
  guestModeEnabled: boolean;
  isTripLocked: boolean;
};

type StoryItem = {
  paragraphId: string;
  text: string;
  dayIndex: number;
  locationLabel: string;
};

function hasStoryCommandPrefix(text: string) {
  return /^\s*\/story\b[ .]*/i.test(text);
}

function stripStoryCommandPrefix(text: string) {
  return text.replace(/^(\s*)\/story\b[ .]*/i, '$1');
}

function buildDayParagraphs(day: TripDayWithRelations) {
  if (day.trip_day_paragraphs?.length) {
    return [...day.trip_day_paragraphs]
      .sort((a, b) => a.position - b.position)
      .map((paragraph) => ({
        id: paragraph.id,
        text: stripStoryCommandPrefix(paragraph.text),
        isStory: paragraph.is_story || hasStoryCommandPrefix(paragraph.text)
      }));
  }

  return (day.journal_entry ?? '')
    .split(/\n{2,}/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((text, index) => ({
      id: `legacy-${day.id}-${index}`,
      text: stripStoryCommandPrefix(text),
      isStory: hasStoryCommandPrefix(text)
    }));
}

export function TripStoriesCarousel({ days, guestModeEnabled, isTripLocked }: TripStoriesCarouselProps) {
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement | null>(null);

  const stories = useMemo<StoryItem[]>(() => {
    const nextStories: StoryItem[] = [];
    days.forEach((day) => {
      const isDayMasked = guestModeEnabled && (isTripLocked || (day.is_locked ?? false));
      if (isDayMasked) {
        return;
      }
      const paragraphs = buildDayParagraphs(day);
      const locationLabel = day.trip_locations?.[0]?.display_name ?? 'No location';
      paragraphs.forEach((paragraph) => {
        if (!paragraph.isStory) {
          return;
        }
        nextStories.push({
          paragraphId: paragraph.id,
          text: paragraph.text,
          dayIndex: day.day_index,
          locationLabel
        });
      });
    });
    return nextStories;
  }, [days, guestModeEnabled, isTripLocked]);

  function goToStory(index: number) {
    if (!carouselRef.current) {
      return;
    }
    const cards = carouselRef.current.querySelectorAll<HTMLDivElement>('[data-story-card]');
    const clampedIndex = Math.min(Math.max(index, 0), cards.length - 1);
    const card = cards.item(clampedIndex);
    if (!card) {
      return;
    }
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    setActiveStoryIndex(clampedIndex);
  }

  function jumpToParagraph(paragraphId: string) {
    const target = document.getElementById(`story-paragraph-${paragraphId}`);
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('ring-2', 'ring-brand/70', 'bg-brand/15');
    window.setTimeout(() => {
      target.classList.remove('ring-2', 'ring-brand/70', 'bg-brand/15');
    }, 900);
  }

  function handleCarouselScroll() {
    if (!carouselRef.current) {
      return;
    }
    const cards = Array.from(carouselRef.current.querySelectorAll<HTMLDivElement>('[data-story-card]'));
    if (!cards.length) {
      return;
    }
    const containerCenter = carouselRef.current.scrollLeft + carouselRef.current.clientWidth / 2;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    cards.forEach((card, index) => {
      const cardCenter = card.offsetLeft + card.clientWidth / 2;
      const distance = Math.abs(containerCenter - cardCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setActiveStoryIndex(closestIndex);
  }

  if (!stories.length) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white">Stories</h2>
      <div
        ref={carouselRef}
        onScroll={handleCarouselScroll}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {stories.map((story, index) => (
          <div
            key={`${story.paragraphId}-${index}`}
            data-story-card
            className="relative w-[88%] shrink-0 snap-center rounded-2xl border border-slate-700 bg-slate-950 p-4"
          >
            <p
              className="text-sm text-slate-100"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {story.text}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Day {story.dayIndex} · {story.locationLabel}
            </p>
            {stories.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="Previous story"
                  onClick={() => goToStory(index - 1)}
                  className="absolute inset-y-0 left-0 w-1/4"
                />
                <button
                  type="button"
                  aria-label="Next story"
                  onClick={() => goToStory(index + 1)}
                  className="absolute inset-y-0 right-0 w-1/4"
                />
              </>
            ) : null}
            <button
              type="button"
              aria-label="Go to story paragraph"
              onClick={() => jumpToParagraph(story.paragraphId)}
              className="absolute inset-y-0 left-1/4 w-1/2"
            />
          </div>
        ))}
      </div>
      {stories.length > 1 ? (
        <div className="flex justify-center gap-2">
          {stories.map((story, index) => (
            <button
              type="button"
              key={`${story.paragraphId}-dot-${index}`}
              aria-label={`Go to story ${index + 1}`}
              onClick={() => goToStory(index)}
              className={`h-2 w-2 rounded-full transition ${
                index === activeStoryIndex ? 'bg-slate-300' : 'bg-slate-600'
              }`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
