export type TripFilterKind = 'dateRange' | 'tripType' | 'tripGroup' | 'tripPeople' | 'favorites';

export type TripFilterClause =
  | {
      id: string;
      kind: 'dateRange';
      startDate: string;
      endDate: string;
    }
  | {
      id: string;
      kind: 'tripType';
      tripTypes: string[];
    }
  | {
      id: string;
      kind: 'tripGroup';
      tripGroupIds: string[];
    }
  | {
      id: string;
      kind: 'tripPeople';
      personIds: string[];
    }
  | {
      id: string;
      kind: 'favorites';
    };

export type TripFilterTripMeta = {
  tripId: string;
  startDate: string;
  endDate: string;
  tripTypes: string[];
  companionGroupIds: string[];
  companionPersonIds: string[];
  hasFavoriteDay: boolean;
};

export type TripGroupMembersIndex = Map<string, string[]>;

export function buildTripGroupMembersIndex(
  groups: Array<{ id: string; members?: Array<{ id: string } | null> | null }>
): TripGroupMembersIndex {
  const map: TripGroupMembersIndex = new Map();
  for (const group of groups ?? []) {
    const memberIds = Array.from(
      new Set((group.members ?? []).map((member) => member?.id ?? null).filter(Boolean) as string[])
    );
    map.set(group.id, memberIds);
  }
  return map;
}

function normalizeTripType(value: string) {
  return value.trim().toLowerCase();
}

function isDateClauseActive(clause: Extract<TripFilterClause, { kind: 'dateRange' }>) {
  return Boolean(clause.startDate || clause.endDate);
}

function isArrayClauseActive(values: string[]) {
  return values.length > 0;
}

function tripOverlapsDateRange(trip: Pick<TripFilterTripMeta, 'startDate' | 'endDate'>, start: string, end: string) {
  if (start && end) {
    return trip.startDate <= end && trip.endDate >= start;
  }
  if (start) {
    return trip.endDate >= start;
  }
  if (end) {
    return trip.startDate <= end;
  }
  return true;
}

function tripMatchesClause(
  trip: TripFilterTripMeta,
  clause: TripFilterClause,
  groupMembersIndex?: TripGroupMembersIndex
): boolean {
  if (clause.kind === 'dateRange') {
    if (!isDateClauseActive(clause)) return true;
    return tripOverlapsDateRange(trip, clause.startDate, clause.endDate);
  }

  if (clause.kind === 'tripType') {
    const selected = clause.tripTypes.map(normalizeTripType).filter(Boolean);
    if (!isArrayClauseActive(selected)) return true;
    const tripTypes = new Set((trip.tripTypes ?? []).map(normalizeTripType).filter(Boolean));
    return selected.some((value) => tripTypes.has(value));
  }

  if (clause.kind === 'tripGroup') {
    if (!isArrayClauseActive(clause.tripGroupIds)) return true;
    const groupIds = new Set(trip.companionGroupIds ?? []);
    return clause.tripGroupIds.some((id) => groupIds.has(id));
  }

  if (clause.kind === 'tripPeople') {
    if (!isArrayClauseActive(clause.personIds)) return true;
    const derivedPeople = new Set<string>(trip.companionPersonIds ?? []);
    for (const groupId of trip.companionGroupIds ?? []) {
      const members = groupMembersIndex?.get(groupId) ?? [];
      members.forEach((id) => derivedPeople.add(id));
    }
    return clause.personIds.some((id) => derivedPeople.has(id));
  }

  if (clause.kind === 'favorites') {
    return Boolean(trip.hasFavoriteDay);
  }

  return true;
}

export function filterTripIds(
  trips: TripFilterTripMeta[],
  clauses: TripFilterClause[],
  groupMembersIndex?: TripGroupMembersIndex
): Set<string> {
  const activeClauses = (clauses ?? []).filter(Boolean);
  if (!activeClauses.length) {
    return new Set(trips.map((trip) => trip.tripId));
  }

  const allowed = new Set<string>();
  for (const trip of trips) {
    const matchesAll = activeClauses.every((clause) => tripMatchesClause(trip, clause, groupMembersIndex));
    if (matchesAll) {
      allowed.add(trip.tripId);
    }
  }
  return allowed;
}

