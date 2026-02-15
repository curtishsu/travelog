'use client';

import { useEffect, useMemo, useState } from 'react';
import { Star } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useUpdateTripDay } from '@/features/trips/hooks';

type TripDayFavoriteButtonProps = {
  tripId: string;
  dayIndex: number;
  isFavorite: boolean;
  disabled?: boolean;
};

export function TripDayFavoriteButton({
  tripId,
  dayIndex,
  isFavorite,
  disabled
}: TripDayFavoriteButtonProps) {
  const { mutateAsync, isPending } = useUpdateTripDay();
  const [localFavorite, setLocalFavorite] = useState(isFavorite);

  useEffect(() => {
    setLocalFavorite(isFavorite);
  }, [isFavorite]);

  const effectiveDisabled = Boolean(disabled) || isPending;
  const ariaLabel = useMemo(
    () => (localFavorite ? 'Unfavorite this day' : 'Favorite this day'),
    [localFavorite]
  );

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={effectiveDisabled}
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={async () => {
        const next = !localFavorite;
        setLocalFavorite(next);
        try {
          await mutateAsync({
            tripId,
            dayIndex,
            payload: { isFavorite: next }
          });
        } catch (error) {
          console.error('[TripDayFavoriteButton] failed to toggle favorite', error);
          setLocalFavorite(!next);
        }
      }}
      className="text-slate-300 hover:text-white"
    >
      <Star className="h-5 w-5" fill={localFavorite ? 'currentColor' : 'none'} />
    </Button>
  );
}

