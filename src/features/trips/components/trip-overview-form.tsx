'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Plus, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { TripOverviewPayload, TripGroupInput } from '@/features/trips/api';
import { TripGroupModal } from '@/features/trips/components/trip-group-modal';
import {
  useTripGroups,
  useCreateTripGroup,
  useUpdateTripGroup,
  useDeleteTripGroup,
  useTripSuggestions
} from '@/features/trips/hooks';
import type { TripGroup } from '@/features/trips/types';

export type TripOverviewFormValues = TripOverviewPayload & {
  tripGroupName?: string | null;
};

type TripOverviewFormProps = {
  initialValues: TripOverviewFormValues;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: TripOverviewFormValues) => Promise<void> | void;
  overlapWarning?: string | null;
};

export function TripOverviewForm({
  initialValues,
  submitLabel,
  isSubmitting,
  onSubmit,
  overlapWarning
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
  const [tripGroupDraft, setTripGroupDraft] = useState(initialValues.tripGroupName ?? '');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupModalMode, setGroupModalMode] = useState<'create' | 'edit'>('create');
  const [groupModalDefaultName, setGroupModalDefaultName] = useState<string | undefined>(undefined);
  const [groupModalGroup, setGroupModalGroup] = useState<TripGroup | null>(null);

  const { data: suggestions } = useTripSuggestions();
  const { data: tripGroups, isLoading: isTripGroupsLoading, error: tripGroupsError } = useTripGroups();
  const { mutateAsync: createTripGroupMutation, isPending: isCreatingGroup } = useCreateTripGroup();
  const { mutateAsync: updateTripGroupMutation, isPending: isUpdatingGroup } = useUpdateTripGroup();
  const { mutateAsync: deleteTripGroupMutation, isPending: isDeletingGroup } = useDeleteTripGroup();

  useEffect(() => {
    reset(initialValues);
    setTripGroupDraft(initialValues.tripGroupName ?? '');
  }, [initialValues, reset]);

  const tripTypes = watch('tripTypes');
  const startDate = watch('startDate');
  const tripGroupId = watch('tripGroupId');

  const selectedTripGroup = useMemo(() => {
    if (!tripGroupId || !tripGroups) {
      return null;
    }
    return tripGroups.find((group) => group.id === tripGroupId) ?? null;
  }, [tripGroupId, tripGroups]);

  const clearTripGroupSelection = useCallback(() => {
    setValue('tripGroupId', null, { shouldDirty: true, shouldValidate: true });
    setTripGroupDraft('');
  }, [setTripGroupDraft, setValue]);

  useEffect(() => {
    if (selectedTripGroup) {
      setTripGroupDraft(selectedTripGroup.name);
    }
  }, [selectedTripGroup]);

  useEffect(() => {
    if (tripGroups && tripGroupId && !selectedTripGroup) {
      clearTripGroupSelection();
    }
  }, [tripGroups, tripGroupId, selectedTripGroup, clearTripGroupSelection]);

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

  const normalizedTripGroupDraft = tripGroupDraft.trim().toLowerCase();
  const hasTripGroups = Boolean(tripGroups?.length);
  const filteredTripGroupSuggestions = useMemo(() => {
    if (!tripGroups?.length || !normalizedTripGroupDraft || selectedTripGroup) {
      return [];
    }
    return tripGroups
      .filter((group) => group.name.toLowerCase().includes(normalizedTripGroupDraft))
      .slice(0, 6);
  }, [tripGroups, normalizedTripGroupDraft, selectedTripGroup]);

  const showCreateTripGroupOption =
    Boolean(normalizedTripGroupDraft) &&
    !(tripGroups ?? []).some((group) => group.name.toLowerCase() === normalizedTripGroupDraft);

  function handleTripGroupInputChange(value: string) {
    setTripGroupDraft(value);
    if (selectedTripGroup && value.trim().toLowerCase() !== selectedTripGroup.name.toLowerCase()) {
      setValue('tripGroupId', null, { shouldDirty: true, shouldValidate: true });
    }
  }

  function handleSelectTripGroup(group: TripGroup) {
    setValue('tripGroupId', group.id, { shouldDirty: true, shouldValidate: true });
    setTripGroupDraft(group.name);
  }

  function openCreateTripGroupModal() {
    setGroupModalMode('create');
    setGroupModalGroup(null);
    setGroupModalDefaultName(tripGroupDraft.trim());
    setIsGroupModalOpen(true);
  }

  function openEditTripGroupModal(group: TripGroup) {
    setGroupModalMode('edit');
    setGroupModalGroup(group);
    setGroupModalDefaultName(undefined);
    setIsGroupModalOpen(true);
  }

  async function handleTripGroupModalSubmit(payload: TripGroupInput) {
    if (groupModalMode === 'edit' && groupModalGroup) {
      const updated = await updateTripGroupMutation({
        groupId: groupModalGroup.id,
        payload
      });
      setValue('tripGroupId', updated.id, { shouldDirty: true, shouldValidate: true });
      setTripGroupDraft(updated.name);
      return updated;
    }
    const created = await createTripGroupMutation(payload);
    setValue('tripGroupId', created.id, { shouldDirty: true, shouldValidate: true });
    setTripGroupDraft(created.name);
    return created;
  }

  async function handleTripGroupDelete(groupId: string) {
    await deleteTripGroupMutation({ groupId });
    if (getValues('tripGroupId') === groupId) {
      clearTripGroupSelection();
    }
  }

  useEffect(() => {
    setValue('tripGroupName', tripGroupDraft, { shouldDirty: false });
  }, [tripGroupDraft, setValue]);

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <input type="hidden" {...register('tripGroupId')} />
        <input type="hidden" {...register('tripGroupName')} />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-200">Trip name</label>
          <input
            type="text"
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
            {!hasTripGroups ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => openCreateTripGroupModal()}
                disabled={isCreatingGroup || isUpdatingGroup || isDeletingGroup}
              >
                Create group
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => selectedTripGroup && openEditTripGroupModal(selectedTripGroup)}
              disabled={!selectedTripGroup || isCreatingGroup || isUpdatingGroup || isDeletingGroup}
            >
              Edit group
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearTripGroupSelection}
              disabled={!tripGroupId}
            >
              Clear
            </Button>
          </div>
        </div>
        <div className="relative">
          {!selectedTripGroup ? (
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          ) : null}
          <input
            type="text"
            value={tripGroupDraft}
            onChange={(event) => handleTripGroupInputChange(event.target.value)}
            placeholder="Type a group name…"
            className={`w-full rounded-2xl border border-slate-800 bg-slate-950 ${selectedTripGroup ? 'pl-4' : 'pl-11'} pr-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30`}
          />
        </div>
        <div className="space-y-2">
          {tripGroupsError ? <p className="text-xs text-red-300">{tripGroupsError.message}</p> : null}
          {!tripGroupsError && isTripGroupsLoading ? (
            <p className="text-xs text-slate-500">Loading trip groups…</p>
          ) : null}
          {!tripGroupsError && !isTripGroupsLoading && filteredTripGroupSuggestions.length ? (
            <div className="flex flex-wrap gap-2">
              {filteredTripGroupSuggestions.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide transition ${
                    group.id === tripGroupId
                      ? 'border-brand bg-brand/20 text-white'
                      : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-brand hover:text-white'
                  }`}
                  onClick={() => handleSelectTripGroup(group)}
                >
                  {group.name}
                </button>
              ))}
            </div>
          ) : null}
          {!tripGroupsError && !isTripGroupsLoading && !hasTripGroups ? (
            <p className="text-xs text-slate-500">No groups yet. Create one to get started.</p>
          ) : null}
          {showCreateTripGroupOption ? (
            <button
              type="button"
              className="rounded-full border border-brand/60 bg-brand/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-brand transition hover:bg-brand/20"
              onClick={() => openCreateTripGroupModal()}
            >
              Create “{tripGroupDraft.trim()}”
            </button>
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

