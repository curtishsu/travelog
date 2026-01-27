'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Lock, Plus, Search, Unlock, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { TripOverviewPayload, TripGroupInput } from '@/features/trips/api';
import { TripGroupModal } from '@/features/trips/components/trip-group-modal';
import {
  useTripGroups,
  useCreateTripGroup,
  useUpdateTripGroup,
  useDeleteTripGroup,
  useTripSuggestions,
  usePeople,
  useCreatePerson
} from '@/features/trips/hooks';
import type { Person, TripGroup } from '@/features/trips/types';

export type TripOverviewFormValues = TripOverviewPayload & {
  tripGroupName?: string | null;
};

type TripOverviewFormProps = {
  initialValues: TripOverviewFormValues;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: TripOverviewFormValues) => Promise<void> | void;
  overlapWarning?: string | null;
  isTripLocked?: boolean;
  onToggleTripLock?: () => void | Promise<void>;
  isTogglingTripLock?: boolean;
  tripLockMessage?: string | null;
  tripLockError?: string | null;
};

export function TripOverviewForm({
  initialValues,
  submitLabel,
  isSubmitting,
  onSubmit,
  overlapWarning,
  isTripLocked = false,
  onToggleTripLock,
  isTogglingTripLock = false,
  tripLockMessage,
  tripLockError
}: TripOverviewFormProps) {
  const form = useForm<TripOverviewFormValues>({
    defaultValues: initialValues
  });
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    watch,
    reset,
    formState: { errors }
  } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'links'
  });

  const [typeDraft, setTypeDraft] = useState('');
  const [companionDraft, setCompanionDraft] = useState('');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupModalMode, setGroupModalMode] = useState<'create' | 'edit'>('create');
  const [groupModalDefaultName, setGroupModalDefaultName] = useState<string | undefined>(undefined);
  const [groupModalGroup, setGroupModalGroup] = useState<TripGroup | null>(null);

  const [isNewCharacterOpen, setIsNewCharacterOpen] = useState(false);
  const [newCharacterMode, setNewCharacterMode] = useState<'person' | 'group'>('person');
  const [newCharacterSeed, setNewCharacterSeed] = useState('');
  const [newPersonFirstName, setNewPersonFirstName] = useState('');
  const [newPersonLastName, setNewPersonLastName] = useState('');
  const [newCharacterError, setNewCharacterError] = useState<string | null>(null);

  const { data: suggestions } = useTripSuggestions();
  const { data: tripGroups, isLoading: isTripGroupsLoading, error: tripGroupsError } = useTripGroups();
  const { mutateAsync: createTripGroupMutation, isPending: isCreatingGroup } = useCreateTripGroup();
  const { mutateAsync: updateTripGroupMutation, isPending: isUpdatingGroup } = useUpdateTripGroup();
  const { mutateAsync: deleteTripGroupMutation, isPending: isDeletingGroup } = useDeleteTripGroup();
  const { data: people, isLoading: isPeopleLoading, error: peopleError } = usePeople();
  const { mutateAsync: createPersonMutation, isPending: isCreatingPerson } = useCreatePerson();

  useEffect(() => {
    reset(initialValues);
    setCompanionDraft('');
    setIsNewCharacterOpen(false);
    setNewCharacterMode('person');
    setNewCharacterSeed('');
    setNewPersonFirstName('');
    setNewPersonLastName('');
    setNewCharacterError(null);
  }, [initialValues, reset]);

  const tripTypes = watch('tripTypes');
  const startDate = watch('startDate');
  const companionGroupIds = watch('companionGroupIds') ?? [];
  const companionPersonIds = watch('companionPersonIds') ?? [];

  function normalizeTripType(value: string) {
    return value.trim().replace(/^#/, '').toLowerCase();
  }

  const filteredTypeSuggestions = useMemo(() => {
    if (!suggestions?.tripTypes?.length || !typeDraft.trim()) {
      return [];
    }
    const draft = normalizeTripType(typeDraft);
    return suggestions.tripTypes
      .map((type) => normalizeTripType(type))
      .filter((type) => type.includes(draft) && !tripTypes.includes(type))
      .slice(0, 6);
  }, [suggestions?.tripTypes, typeDraft, tripTypes]);

  function handleAddType() {
    const normalized = normalizeTripType(typeDraft);
    if (!normalized) {
      return;
    }
    if (tripTypes.includes(normalized)) {
      setTypeDraft('');
      return;
    }
    setValue('tripTypes', [...tripTypes, normalized], { shouldDirty: true, shouldValidate: true });
    setTypeDraft('');
  }

  function handleRemoveType(index: number) {
    const next = tripTypes.filter((_, idx) => idx !== index);
    setValue('tripTypes', next);
  }

  const linkErrors = useMemo(() => {
    return fields.map((_, index) => ({
      label: errors.links?.[index]?.label?.message,
      url: errors.links?.[index]?.url?.message
    }));
  }, [errors.links, fields]);

  function formatPersonName(person: Person) {
    const first = person.first_name?.trim() ?? '';
    const last = person.last_name?.trim() ?? '';
    return [first, last].filter(Boolean).join(' ');
  }

  const normalizedCompanionDraft = companionDraft.trim().toLowerCase();
  const hasTripGroups = Boolean(tripGroups?.length);
  const selectedGroups = useMemo(() => {
    const map = new Map((tripGroups ?? []).map((group) => [group.id, group]));
    return companionGroupIds.map((id) => map.get(id)).filter(Boolean) as TripGroup[];
  }, [companionGroupIds, tripGroups]);

  const selectedPeople = useMemo(() => {
    const map = new Map((people ?? []).map((person) => [person.id, person]));
    return companionPersonIds.map((id) => map.get(id)).filter(Boolean) as Person[];
  }, [companionPersonIds, people]);

  // Keep legacy tripGroupId loosely in sync for backwards compatibility elsewhere in the app.
  useEffect(() => {
    const derived = companionGroupIds.length === 1 ? companionGroupIds[0] : null;
    setValue('tripGroupId', derived, { shouldDirty: false, shouldValidate: false });
  }, [companionGroupIds, setValue]);

  const filteredTripGroupSuggestions = useMemo(() => {
    if (!tripGroups?.length || !normalizedCompanionDraft) {
      return [];
    }
    return tripGroups
      .filter((group) => !companionGroupIds.includes(group.id))
      .filter((group) => group.name.toLowerCase().includes(normalizedCompanionDraft))
      .slice(0, 6);
  }, [tripGroups, normalizedCompanionDraft, companionGroupIds]);

  const filteredPeopleSuggestions = useMemo(() => {
    if (!people?.length || !normalizedCompanionDraft) {
      return [];
    }
    return people
      .filter((person) => !companionPersonIds.includes(person.id))
      .filter((person) => formatPersonName(person).toLowerCase().includes(normalizedCompanionDraft))
      .slice(0, 6);
  }, [people, normalizedCompanionDraft, companionPersonIds]);

  function addCompanionGroup(groupId: string) {
    const next = Array.from(new Set([...(getValues('companionGroupIds') ?? []), groupId]));
    setValue('companionGroupIds', next, { shouldDirty: true, shouldValidate: true });
  }

  function addCompanionPerson(personId: string) {
    const next = Array.from(new Set([...(getValues('companionPersonIds') ?? []), personId]));
    setValue('companionPersonIds', next, { shouldDirty: true, shouldValidate: true });
  }

  function removeCompanionGroup(groupId: string) {
    const next = (getValues('companionGroupIds') ?? []).filter((id) => id !== groupId);
    setValue('companionGroupIds', next, { shouldDirty: true, shouldValidate: true });
  }

  function removeCompanionPerson(personId: string) {
    const next = (getValues('companionPersonIds') ?? []).filter((id) => id !== personId);
    setValue('companionPersonIds', next, { shouldDirty: true, shouldValidate: true });
  }

  function openCreateTripGroupModal(defaultName?: string) {
    setGroupModalMode('create');
    setGroupModalGroup(null);
    setGroupModalDefaultName(defaultName);
    setIsGroupModalOpen(true);
  }

  async function handleTripGroupModalSubmit(payload: TripGroupInput) {
    if (groupModalMode === 'edit' && groupModalGroup) {
      const updated = await updateTripGroupMutation({
        groupId: groupModalGroup.id,
        payload
      });
      addCompanionGroup(updated.id);
      return updated;
    }
    const created = await createTripGroupMutation(payload);
    addCompanionGroup(created.id);
    return created;
  }

  async function handleTripGroupDelete(groupId: string) {
    await deleteTripGroupMutation({ groupId });
    removeCompanionGroup(groupId);
  }

  function openNewCharacterFromDraft() {
    const seed = companionDraft.trim();
    if (!seed) {
      return;
    }
    const [first, ...rest] = seed.split(/\s+/);
    setNewCharacterSeed(seed);
    setNewCharacterMode('person');
    setNewPersonFirstName(first ?? '');
    setNewPersonLastName(rest.join(' '));
    setNewCharacterError(null);
    setIsNewCharacterOpen(true);
  }

  async function handleCreatePersonFromModal() {
    if (isCreatingPerson) return;
    const first = newPersonFirstName.trim();
    const last = newPersonLastName.trim();
    if (!first) {
      setNewCharacterError('First name is required.');
      return;
    }
    setNewCharacterError(null);
    try {
      const created = await createPersonMutation({
        firstName: first,
        lastName: last ? last : null
      });
      addCompanionPerson(created.id);
      setIsNewCharacterOpen(false);
      setCompanionDraft('');
    } catch (error) {
      setNewCharacterError(error instanceof Error ? error.message : 'Failed to create person.');
    }
  }

  const showLockControls = typeof onToggleTripLock === 'function';

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {tripLockError ? <p className="text-sm text-red-300">{tripLockError}</p> : null}
        {tripLockMessage ? <p className="text-sm text-emerald-300">{tripLockMessage}</p> : null}
        <input type="hidden" {...register('tripGroupId')} />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium text-slate-200" htmlFor="trip-name">
              Trip name
            </label>
            {showLockControls ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="flex items-center gap-2"
                onClick={() => {
                  void onToggleTripLock?.();
                }}
                disabled={isSubmitting || isTogglingTripLock}
                aria-label={isTripLocked ? 'Unlock trip content' : 'Lock trip content'}
                title={
                  isTripLocked
                    ? 'Trip content is currently locked. Click to unlock.'
                    : 'Lock trip content so private entries stay hidden in Guest Mode.'
                }
              >
                {isTripLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                {isTripLocked ? 'Unlock trip' : 'Lock trip'}
              </Button>
            ) : null}
          </div>
          <input
            type="text"
            id="trip-name"
            className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            placeholder="Trip Name"
            {...register('name', { required: 'Trip name is required', minLength: 2 })}
          />
          {errors.name ? <p className="text-xs text-red-300">{errors.name.message}</p> : null}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Start date</label>
            <input
              type="date"
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              {...register('startDate', { required: 'Start date is required' })}
            />
            {errors.startDate ? <p className="text-xs text-red-300">{errors.startDate.message}</p> : null}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">End date</label>
            <input
              type="date"
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              {...register('endDate', {
                required: 'End date is required',
                validate: (value) =>
                  !startDate || !value || value >= startDate || 'End date must be after start date'
              })}
            />
            {errors.endDate ? <p className="text-xs text-red-300">{errors.endDate.message}</p> : null}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Trip group</h3>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setValue('companionGroupIds', [], { shouldDirty: true, shouldValidate: true });
                setValue('companionPersonIds', [], { shouldDirty: true, shouldValidate: true });
              }}
              disabled={companionGroupIds.length === 0 && companionPersonIds.length === 0}
            >
              Clear
            </Button>
          </div>
        </div>
        {selectedGroups.length || selectedPeople.length ? (
          <div className="flex flex-wrap gap-2">
            {selectedGroups.map((group) => (
              <span
                key={`group-${group.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-700 bg-emerald-900/10 px-3 py-1 text-xs font-medium text-emerald-200"
              >
                {group.name}
                <button
                  type="button"
                  onClick={() => removeCompanionGroup(group.id)}
                  className="rounded-full p-0.5 text-emerald-200/80 hover:bg-emerald-900/30 hover:text-emerald-100"
                  aria-label={`Remove group ${group.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            {selectedPeople.map((person) => (
              <span
                key={`person-${person.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-blue-600 bg-blue-900/10 px-3 py-1 text-xs font-medium text-blue-200"
              >
                {formatPersonName(person)}
                <button
                  type="button"
                  onClick={() => removeCompanionPerson(person.id)}
                  className="rounded-full p-0.5 text-blue-200/80 hover:bg-blue-900/30 hover:text-blue-100"
                  aria-label={`Remove person ${formatPersonName(person)}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Add the people or groups you traveled with.</p>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={companionDraft}
            onChange={(event) => setCompanionDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              const seed = companionDraft.trim();
              if (!seed) return;
              const seedLower = seed.toLowerCase();
              const exactGroup = (tripGroups ?? []).find((group) => group.name.toLowerCase() === seedLower);
              if (exactGroup) {
                addCompanionGroup(exactGroup.id);
                setCompanionDraft('');
                return;
              }
              const exactPerson = (people ?? []).find(
                (person) => formatPersonName(person).toLowerCase() === seedLower
              );
              if (exactPerson) {
                addCompanionPerson(exactPerson.id);
                setCompanionDraft('');
                return;
              }
              openNewCharacterFromDraft();
            }}
            placeholder="Type a person or group…"
            className="w-full rounded-2xl border border-slate-800 bg-slate-950 pl-11 pr-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </div>

        <div className="space-y-2">
          {tripGroupsError ? <p className="text-xs text-red-300">{tripGroupsError.message}</p> : null}
          {peopleError ? <p className="text-xs text-red-300">{peopleError.message}</p> : null}
          {!tripGroupsError && isTripGroupsLoading ? (
            <p className="text-xs text-slate-500">Loading groups…</p>
          ) : null}
          {!peopleError && isPeopleLoading ? <p className="text-xs text-slate-500">Loading people…</p> : null}

          {normalizedCompanionDraft && (filteredTripGroupSuggestions.length || filteredPeopleSuggestions.length) ? (
            <div className="flex flex-wrap gap-2">
              {filteredTripGroupSuggestions.map((group) => (
                <button
                  key={`suggest-group-${group.id}`}
                  type="button"
                  className="rounded-full border border-emerald-700 bg-slate-900 px-3 py-1 text-xs font-medium text-emerald-200 transition hover:bg-slate-800"
                  onClick={() => {
                    addCompanionGroup(group.id);
                    setCompanionDraft('');
                  }}
                >
                  {group.name}
                </button>
              ))}
              {filteredPeopleSuggestions.map((person) => (
                <button
                  key={`suggest-person-${person.id}`}
                  type="button"
                  className="rounded-full border border-blue-600 bg-slate-900 px-3 py-1 text-xs font-medium text-blue-200 transition hover:bg-slate-800"
                  onClick={() => {
                    addCompanionPerson(person.id);
                    setCompanionDraft('');
                  }}
                >
                  {formatPersonName(person)}
                </button>
              ))}
            </div>
          ) : null}

          {normalizedCompanionDraft &&
          !filteredTripGroupSuggestions.length &&
          !filteredPeopleSuggestions.length ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full border border-blue-600/70 bg-blue-900/10 px-3 py-1 text-xs font-medium text-blue-200 transition hover:bg-blue-900/20"
                onClick={() => {
                  setNewCharacterMode('person');
                  openNewCharacterFromDraft();
                }}
              >
                New person “{companionDraft.trim()}”
              </button>
              <button
                type="button"
                className="rounded-full border border-emerald-700/70 bg-emerald-900/10 px-3 py-1 text-xs font-medium text-emerald-200 transition hover:bg-emerald-900/20"
                onClick={() => {
                  openCreateTripGroupModal(companionDraft.trim());
                }}
                disabled={isCreatingGroup || isUpdatingGroup || isDeletingGroup}
              >
                New group “{companionDraft.trim()}”
              </button>
            </div>
          ) : null}

          {!normalizedCompanionDraft && !hasTripGroups ? (
            <p className="text-xs text-slate-500">No groups yet. Create one to get started.</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Links</h3>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => append({ label: '', url: '' })}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add link
          </Button>
        </div>
        {fields.length === 0 ? (
          <p className="text-sm text-slate-500">Add itinerary, maps, or other helpful links.</p>
        ) : null}
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4 md:grid-cols-[1fr,1fr,auto]"
            >
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Label</label>
                <input
                  type="text"
                  className=" w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                  {...register(`links.${index}.label`, { required: 'Label is required' })}
                />
                {linkErrors[index]?.label ? (
                  <p className="text-xs text-red-300">{linkErrors[index]?.label}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-slate-400">URL</label>
                <input
                  type="url"
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                  {...register(`links.${index}.url`, { required: 'URL is required' })}
                />
                {linkErrors[index]?.url ? (
                  <p className="text-xs text-red-300">{linkErrors[index]?.url}</p>
                ) : null}
              </div>
              <div className="flex items-center justify-end md:items-start">
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-800 text-slate-400 transition hover:text-white"
                  onClick={() => remove(index)}
                  aria-label="Remove link"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-white">Trip types</h3>
        <div className="flex flex-wrap gap-2">
          {tripTypes.map((type, index) => (
            <span
              key={`${type}-${index}`}
              className="flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-200"
            >
              #{type}
              <button
                type="button"
                className="text-slate-400 transition hover:text-white"
                onClick={() => handleRemoveType(index)}
                aria-label={`Remove ${type}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={typeDraft}
            onChange={(event) => setTypeDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleAddType();
              }
            }}
            placeholder="e.g. #adventure"
            className="flex-1 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
          <Button type="button" variant="secondary" onClick={handleAddType}>
            Add type
          </Button>
        </div>
        {filteredTypeSuggestions.length ? (
          <div className="flex flex-wrap gap-2">
            {filteredTypeSuggestions.map((suggestion) => (
              <button
                  key={suggestion}
                type="button"
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-200 transition hover:border-brand hover:text-white"
                onClick={() => {
                    if (tripTypes.includes(suggestion)) {
                      setTypeDraft('');
                      return;
                    }
                    setValue('tripTypes', [...tripTypes, suggestion], {
                      shouldDirty: true,
                      shouldValidate: true
                    });
                  setTypeDraft('');
                }}
              >
                  #{suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {overlapWarning ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          {overlapWarning}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
      {isNewCharacterOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <button
              type="button"
              className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              onClick={() => setIsNewCharacterOpen(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-white">New Character</h3>
                {newCharacterSeed ? (
                  <p className="text-sm text-slate-400">From: “{newCharacterSeed}”</p>
                ) : null}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewCharacterMode('person')}
                  className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide transition ${
                    newCharacterMode === 'person'
                      ? 'border-blue-600 bg-blue-900/20 text-blue-100'
                      : 'border-slate-700 bg-slate-950 text-slate-200 hover:border-blue-600'
                  }`}
                >
                  Person
                </button>
                <button
                  type="button"
                  onClick={() => setNewCharacterMode('group')}
                  className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide transition ${
                    newCharacterMode === 'group'
                      ? 'border-emerald-700 bg-emerald-900/20 text-emerald-100'
                      : 'border-slate-700 bg-slate-950 text-slate-200 hover:border-emerald-700'
                  }`}
                >
                  Group
                </button>
              </div>

              {newCharacterMode === 'person' ? (
                <div className="space-y-3">
                  {newCharacterError ? <p className="text-sm text-red-300">{newCharacterError}</p> : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        First name
                      </label>
                      <input
                        type="text"
                        value={newPersonFirstName}
                        onChange={(event) => setNewPersonFirstName(event.target.value)}
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Last name (optional)
                      </label>
                      <input
                        type="text"
                        value={newPersonLastName}
                        onChange={(event) => setNewPersonLastName(event.target.value)}
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <Button type="button" variant="ghost" onClick={() => setIsNewCharacterOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="button" onClick={() => void handleCreatePersonFromModal()} disabled={isCreatingPerson}>
                      {isCreatingPerson ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-300">
                    Create a new group (with members) and add it to this trip.
                  </p>
                  <div className="flex items-center justify-end gap-3">
                    <Button type="button" variant="ghost" onClick={() => setIsNewCharacterOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        const seed = newCharacterSeed.trim();
                        setIsNewCharacterOpen(false);
                        openCreateTripGroupModal(seed || undefined);
                      }}
                      disabled={isCreatingGroup || isUpdatingGroup || isDeletingGroup}
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
      <TripGroupModal
        mode={groupModalMode}
        isOpen={isGroupModalOpen}
        group={groupModalGroup}
        defaultName={groupModalDefaultName}
        onClose={() => setIsGroupModalOpen(false)}
        onSubmit={handleTripGroupModalSubmit}
        onDelete={
          groupModalMode === 'edit' && groupModalGroup
            ? (groupId) => handleTripGroupDelete(groupId)
            : undefined
        }
      />
    </>
  );
}

