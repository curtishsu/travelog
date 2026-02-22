'use client';

import { useMemo } from 'react';
import { Hash, MapPin } from 'lucide-react';

import { PhotoGallery } from '@/features/photos/components/photo-gallery';
import type { TripDayWithRelations } from '@/features/trips/types';
import { formatDateForDisplay } from '@/lib/date';
import { MinimalMarkdown } from '@/components/ui/minimal-markdown';
import { TripDayFavoriteButton } from '@/features/trips/components/trip-day-favorite-button';

type TripDaySectionProps = {
  day: TripDayWithRelations;
  guestModeEnabled: boolean;
  isTripLocked: boolean;
};

function hasStoryCommandPrefix(text: string) {
  return /^\s*\/story\b[ .]*/i.test(text);
}

function stripStoryCommandPrefix(text: string) {
  return text.replace(/^(\s*)\/story\b[ .]*/i, '$1');
}

function renderLocations(day: TripDayWithRelations) {
  if (!day.trip_locations?.length) {
    return null;
  }

  const locations = day.trip_locations.map((location) => location.display_name).join(' • ');

  return (
    <div className="flex items-start gap-2 text-sm text-slate-300">
      <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
      <p>{locations}</p>
    </div>
  );
}

function renderHashtags(day: TripDayWithRelations) {
  if (!day.trip_day_hashtags?.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-300">
      <Hash className="mr-1 h-3 w-3 text-slate-500" />
      {day.trip_day_hashtags.map((tag) => (
        <span key={tag.id} className="rounded-full bg-slate-800 px-3 py-1 text-slate-100">
          #{tag.hashtag}
        </span>
      ))}
    </div>
  );
}

export function TripDaySection({ day, guestModeEnabled, isTripLocked }: TripDaySectionProps) {
  const paragraphs = useMemo(() => {
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
  }, [day.id, day.journal_entry, day.trip_day_paragraphs]);

  const hasHighlight = Boolean(day.highlight?.trim());
  const hasJournal = paragraphs.length > 0;
  const hasContent =
    hasHighlight ||
    hasJournal ||
    (day.trip_locations?.length ?? 0) > 0 ||
    (day.trip_day_hashtags?.length ?? 0) > 0 ||
    (day.photos?.length ?? 0) > 0;
  const isDayMasked = guestModeEnabled && (isTripLocked || (day.is_locked ?? false));
  const favoriteDisabled = guestModeEnabled || isTripLocked || (day.is_locked ?? false);
  const isFavorite = Boolean((day as unknown as { is_favorite?: boolean | null }).is_favorite);

  return (
    <section id={`day-${day.day_index}`} className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-white">
            Day {day.day_index}{' '}
            <span className="text-sm font-normal text-slate-400">• {formatDateForDisplay(day.date)}</span>
          </h2>
        </div>
        <TripDayFavoriteButton
          tripId={day.trip_id}
          dayIndex={day.day_index}
          isFavorite={isFavorite}
          disabled={favoriteDisabled}
        />
      </header>
      {hasContent ? (
        <div className="space-y-4 text-sm leading-relaxed text-slate-300">
          {!isDayMasked && day.photos?.length ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-white">Photos</p>
              <PhotoGallery photos={day.photos} layout="carousel" />
            </div>
          ) : null}
          {renderLocations(day)}
          {!isDayMasked && hasHighlight ? (
            <div>
              <p className="font-semibold text-slate-100">Highlight</p>
              <MinimalMarkdown value={day.highlight ?? ''} className="mt-1" />
            </div>
          ) : null}
          {!isDayMasked && hasJournal ? (
            <div>
              <p className="font-semibold text-slate-100">Journal</p>
              <div className="mt-2 space-y-3">
                {paragraphs.map((paragraph) => (
                  <div
                    key={paragraph.id}
                    id={`story-paragraph-${paragraph.id}`}
                    className="rounded-xl bg-transparent px-3 py-2 transition"
                  >
                    <MinimalMarkdown value={paragraph.text} className="mt-1" />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {renderHashtags(day)}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Nothing recorded for this day yet.</p>
      )}
    </section>
  );
}

