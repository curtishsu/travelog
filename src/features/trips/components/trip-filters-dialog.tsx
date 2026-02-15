'use client';

import { useMemo } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { usePeople, useTripGroups, useTripSuggestions } from '@/features/trips/hooks';
import type { TripFilterClause, TripFilterKind } from '@/features/trips/filtering';

type TripFiltersDialogProps = {
  open: boolean;
  clauses: TripFilterClause[];
  onChange: (next: TripFilterClause[]) => void;
  onClose: () => void;
  onApply: () => void;
  title?: string;
  exclusiveKinds?: TripFilterKind[];
};

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createEmptyClause(): TripFilterClause {
  return { id: createId(), kind: 'dateRange', startDate: '', endDate: '' };
}

function clampClauses(clauses: TripFilterClause[]) {
  return clauses.length ? clauses : [createEmptyClause()];
}

export function TripFiltersDialog({
  open,
  clauses,
  onChange,
  onClose,
  onApply,
  title = 'Filter trips',
  exclusiveKinds = []
}: TripFiltersDialogProps) {
  const { data: suggestions } = useTripSuggestions();
  const { data: tripGroups } = useTripGroups();
  const { data: people } = usePeople();

  const tripTypeOptions = useMemo(() => {
    return Array.from(new Set((suggestions?.tripTypes ?? []).map((t) => t.trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [suggestions?.tripTypes]);

  const groupOptions = useMemo(() => {
    return (tripGroups ?? []).map((group) => ({ id: group.id, label: group.name }));
  }, [tripGroups]);

  const peopleOptions = useMemo(() => {
    return (people ?? []).map((person) => ({
      id: person.id,
      label: [person.first_name, person.last_name].filter(Boolean).join(' ')
    }));
  }, [people]);

  const safeClauses = useMemo(() => clampClauses(clauses ?? []), [clauses]);
  const exclusiveKindSet = useMemo(() => new Set<TripFilterKind>(exclusiveKinds), [exclusiveKinds]);
  const hasExclusiveClause = useMemo(
    () => safeClauses.some((clause) => exclusiveKindSet.has(clause.kind)),
    [safeClauses, exclusiveKindSet]
  );

  if (!open) return null;

  function updateClause(id: string, next: TripFilterClause) {
    if (exclusiveKindSet.has(next.kind)) {
      onChange([next]);
      return;
    }
    onChange(safeClauses.map((clause) => (clause.id === id ? next : clause)));
  }

  function removeClause(id: string) {
    const next = safeClauses.filter((clause) => clause.id !== id);
    onChange(clampClauses(next));
  }

  function addClause() {
    if (hasExclusiveClause) {
      return;
    }
    onChange([...safeClauses, createEmptyClause()]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur">
      <div className="w-full max-w-lg space-y-5 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="text-sm text-slate-400">
              Add clauses to narrow results. Clauses combine with <span className="font-semibold text-slate-200">AND</span>
              {hasExclusiveClause ? <span className="text-slate-400"> (some filters are exclusive)</span> : null}.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close filters">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {safeClauses.map((clause, index) => (
            <div key={clause.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Filter {index + 1}</p>
                {safeClauses.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-slate-400 hover:text-white"
                    onClick={() => removeClause(clause.id)}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>

              <div className="mt-3 space-y-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Type</label>
                  <select
                    value={clause.kind}
                    onChange={(event) => {
                      const kind = event.target.value as TripFilterKind;
                      if (kind === 'dateRange') {
                        updateClause(clause.id, { id: clause.id, kind, startDate: '', endDate: '' });
                      } else if (kind === 'tripType') {
                        updateClause(clause.id, { id: clause.id, kind, tripTypes: [] });
                      } else if (kind === 'tripGroup') {
                        updateClause(clause.id, { id: clause.id, kind, tripGroupIds: [] });
                      } else if (kind === 'favorites') {
                        updateClause(clause.id, { id: clause.id, kind });
                      } else {
                        updateClause(clause.id, { id: clause.id, kind, personIds: [] });
                      }
                    }}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                  >
                    <option value="dateRange">Date Range</option>
                    <option value="tripType">Trip Type</option>
                    <option value="tripGroup">Trip Group</option>
                    <option value="tripPeople">Trip People</option>
                    <option value="favorites">Favorites</option>
                  </select>
                </div>

                {clause.kind === 'dateRange' ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Start</label>
                      <input
                        type="date"
                        value={clause.startDate}
                        onChange={(event) =>
                          updateClause(clause.id, { ...clause, startDate: event.target.value })
                        }
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-slate-400">End</label>
                      <input
                        type="date"
                        value={clause.endDate}
                        onChange={(event) => updateClause(clause.id, { ...clause, endDate: event.target.value })}
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                      />
                    </div>
                  </div>
                ) : null}

                {clause.kind === 'tripType' ? (
                  <MultiSelectList
                    label="Trip types"
                    options={tripTypeOptions.map((value) => ({ id: value, label: value }))}
                    selected={clause.tripTypes}
                    onChange={(next) => updateClause(clause.id, { ...clause, tripTypes: next })}
                  />
                ) : null}

                {clause.kind === 'tripGroup' ? (
                  <MultiSelectList
                    label="Trip groups"
                    options={groupOptions}
                    selected={clause.tripGroupIds}
                    onChange={(next) => updateClause(clause.id, { ...clause, tripGroupIds: next })}
                  />
                ) : null}

                {clause.kind === 'tripPeople' ? (
                  <MultiSelectList
                    label="People"
                    options={peopleOptions}
                    selected={clause.personIds}
                    onChange={(next) => updateClause(clause.id, { ...clause, personIds: next })}
                  />
                ) : null}

                {clause.kind === 'favorites' ? (
                  <p className="text-sm text-slate-300">Only show trips that include at least one favorited day.</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="secondary" onClick={addClause} disabled={hasExclusiveClause}>
            + Filter
          </Button>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChange([createEmptyClause()])}
              className="text-slate-300"
            >
              Clear
            </Button>
            <Button
              type="button"
              onClick={() => {
                onApply();
                onClose();
              }}
            >
              Filter
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MultiSelectList({
  label,
  options,
  selected,
  onChange
}: {
  label: string;
  options: Array<{ id: string; label: string }>;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const selectedSet = useMemo(() => new Set(selected ?? []), [selected]);
  const sortedOptions = useMemo(() => options.slice().sort((a, b) => a.label.localeCompare(b.label)), [options]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-slate-400 hover:text-white"
          onClick={() => onChange([])}
          disabled={(selected ?? []).length === 0}
        >
          Clear
        </Button>
      </div>
      <div className="max-h-44 space-y-2 overflow-auto rounded-2xl border border-slate-800 bg-slate-950 p-3">
        {sortedOptions.length ? (
          sortedOptions.map((option) => {
            const checked = selectedSet.has(option.id);
            return (
              <label key={option.id} className="flex cursor-pointer items-center gap-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    const next = new Set(selectedSet);
                    if (event.target.checked) {
                      next.add(option.id);
                    } else {
                      next.delete(option.id);
                    }
                    onChange(Array.from(next));
                  }}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-brand focus:ring-brand/40"
                />
                <span className="flex-1">{option.label}</span>
              </label>
            );
          })
        ) : (
          <p className="text-sm text-slate-400">No options yet.</p>
        )}
      </div>
    </div>
  );
}

