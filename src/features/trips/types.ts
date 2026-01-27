import type { Tables, TripStatus } from '@/types/database';

export type TripTypeSummary = {
  type: string;
};

export type TripDayHashtagSummary = {
  hashtag: string;
};

export type TripDaySummary = {
  id: string;
  day_index: number;
  trip_day_hashtags: TripDayHashtagSummary[];
};

export type TripSummary = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: TripStatus;
  created_at: string;
  updated_at: string;
  trip_types: TripTypeSummary[];
  trip_days: TripDaySummary[];
};

export type TripLink = Tables<'trip_links'>;
export type TripType = Tables<'trip_types'>;
export type TripDay = Tables<'trip_days'>;
export type TripLocation = Tables<'trip_locations'>;
export type TripPhoto = Tables<'photos'>;
export type TripDayHashtag = Tables<'trip_day_hashtags'>;

export type TripDayWithRelations = TripDay & {
  trip_locations: TripLocation[];
  photos: TripPhoto[];
  trip_day_hashtags: TripDayHashtag[];
};

export type TripDetail = Tables<'trips'> & {
  trip_links: TripLink[];
  trip_types: TripType[];
  trip_days: TripDayWithRelations[];
  trip_group: TripGroup | null;
  trip_companion_groups?: TripCompanionGroup[];
  trip_companion_people?: TripCompanionPerson[];
};

export type Person = Tables<'people'>;

export type TripGroup = Tables<'trip_groups'> & {
  members: Person[];
};

export type TripCompanionGroup = Tables<'trip_companion_groups'>;
export type TripCompanionPerson = Tables<'trip_companion_people'>;

export type OverlapWarning = {
  message: string;
  overlaps: Array<Pick<Tables<'trips'>, 'id' | 'name' | 'start_date' | 'end_date'>>;
};

