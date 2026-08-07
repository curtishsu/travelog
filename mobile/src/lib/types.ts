export type TripStatus = 'draft' | 'active' | 'completed';

export type TripTypeSummary = {
  type: string;
};

export type TripDayHashtagSummary = {
  hashtag: string;
};

export type TripDaySummary = {
  id: string;
  day_index: number;
  is_favorite: boolean;
  trip_day_hashtags: TripDayHashtagSummary[];
};

export type TripSummary = {
  id: string;
  name: string;
  timezone?: string | null;
  start_date: string;
  end_date: string;
  status: TripStatus;
  created_at: string;
  updated_at: string;
  trip_types: TripTypeSummary[];
  trip_days: TripDaySummary[];
};

export type TripLink = {
  id: string;
  trip_id: string;
  label: string;
  url: string;
  created_at: string;
};

export type TripType = {
  id: string;
  trip_id: string;
  type: string;
  created_at: string;
};

export type TripLocation = {
  id: string;
  trip_day_id: string;
  display_name: string;
  city: string | null;
  region: string | null;
  country: string | null;
  lat: number;
  lng: number;
  created_at: string;
};

export type TripPhoto = {
  id: string;
  trip_id: string;
  trip_day_id: string;
  trip_location_id: string | null;
  thumbnail_url: string;
  full_url: string;
  width: number | null;
  height: number | null;
  created_at: string;
};

export type TripDayParagraph = {
  id: string;
  trip_day_id: string;
  position: number;
  text: string;
  is_story: boolean;
  created_at: string;
  updated_at: string;
};

export type TripDayHashtag = {
  id: string;
  trip_day_id: string;
  hashtag: string;
  created_at: string;
};

export type TripDayWithRelations = {
  id: string;
  trip_id: string;
  day_index: number;
  date: string;
  highlight: string | null;
  journal_entry: string | null;
  is_locked: boolean;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  trip_locations: TripLocation[];
  photos: TripPhoto[];
  trip_day_hashtags: TripDayHashtag[];
  trip_day_paragraphs: TripDayParagraph[];
};

export type TripDetail = {
  id: string;
  user_id: string;
  name: string;
  timezone: string | null;
  start_date: string;
  end_date: string;
  reflection: string | null;
  status: TripStatus;
  created_at: string;
  updated_at: string;
  trip_group_id: string | null;
  is_trip_content_locked: boolean;
  is_reflection_locked: boolean;
  trip_links: TripLink[];
  trip_types: TripType[];
  trip_days: TripDayWithRelations[];
};

export type OverlapWarning = {
  message: string;
  overlaps: Array<{
    id: string;
    name: string;
    start_date: string;
    end_date: string;
  }>;
};

export type LocationInput = {
  displayName: string;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  lat: number;
  lng: number;
};

export type TripOverviewPayload = {
  name: string;
  startDate: string;
  endDate: string;
  timezone?: string | null;
  reflection?: string | null;
  tripTypes?: string[];
};

export type TripDayUpdatePayload = {
  highlight?: string | null;
  journalEntry?: string | null;
  paragraphs?: Array<{
    id?: string;
    text: string;
    isStory?: boolean;
  }>;
  isFavorite?: boolean;
  hashtags?: string[];
  locationsToAdd?: LocationInput[];
  locationIdsToRemove?: string[];
  isLocked?: boolean;
};

export type GuestModeSettings = {
  guestModeEnabled: boolean;
};

export type LocationSuggestion = LocationInput & {
  id: string;
};
