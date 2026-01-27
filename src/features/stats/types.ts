export type TripTypeSummary = {
  tripId: string;
  tripName: string;
};

export type HashtagTripDaySummary = {
  tripId: string;
  tripName: string;
  dayIndex: number;
};

export type TravelDayDetail = {
  tripId: string;
  tripName: string;
  dayIndex: number;
  date: string;
};

export type TrendTripBucket = {
  bucket: string;
  tripCount: number;
  trips: TripTypeSummary[];
};

export type TrendTravelDayBucket = {
  bucket: string;
  dayCount: number;
  trips: TripTypeSummary[];
  tripDays: TravelDayDetail[];
};

export type MostVisitedLocationSummary = {
  city: string | null;
  country: string | null;
  tripCount: number;
  daysHere: number;
};

export type MostVisitedSummary =
  | {
      trips: MostVisitedLocationSummary[];
      days: MostVisitedLocationSummary[];
    }
  | null;

export type StatsSummary = {
  totalTrips: number;
  totalTravelDays: number;
  countriesVisited: number;
  locationsVisited: number;
  mostVisited: MostVisitedSummary;
  hashtagDistribution: Array<{ hashtag: string; dayCount: number; tripDays: HashtagTripDaySummary[] }>;
  tripTypeDistribution: Array<{ type: string; tripCount: number; trips: TripTypeSummary[] }>;
  tripCompanionPersonDistribution: Array<{
    personId: string;
    firstName: string;
    lastName: string | null;
    tripCount: number;
    trips: TripTypeSummary[];
  }>;
  tripCompanionGroupDistribution: Array<{
    groupId: string;
    groupName: string;
    tripCount: number;
    trips: TripTypeSummary[];
  }>;
  tripTrendsYear: TrendTripBucket[];
  tripTrendsMonth: TrendTripBucket[];
  travelDayTrendsYear: TrendTravelDayBucket[];
  travelDayTrendsMonth: TrendTravelDayBucket[];
};

