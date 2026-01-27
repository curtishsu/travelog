'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { TripGroup } from '@/features/trips/types';
import type { TripGroupInput, TripGroupMemberInput } from '@/features/trips/api';

type TripGroupModalMode = 'create' | 'edit';

type TripGroupModalProps = {
  mode: TripGroupModalMode;
  isOpen: boolean;
  group?: TripGroup | null;
  defaultName?: string;
  onClose: () => void;
  onSubmit: (payload: TripGroupInput) => Promise<TripGroup>;
  onDelete?: (groupId: string) => Promise<void>;
};

type MemberDraft = TripGroupMemberInput & {
  rowId: string;
};

const createEmptyMember = (rowId: string): MemberDraft => ({
  rowId,
  firstName: '',
  lastName: ''
});

function normalizeMemberDrafts(members: MemberDraft[]) {
  return members
    .map((member) => ({
      id: member.id,
      firstName: member.firstName?.trim() ?? '',
      lastName: member.lastName?.trim() ?? ''
    }))
    .filter((member) => member.firstName || member.lastName);
}

function dedupeMembers(members: Array<TripGroupMemberInput & { firstName: string; lastName: string }>) {
  const seen = new Set<string>();
  return members.filter((member) => {
    const key = `${member.firstName.toLowerCase()}|${member.lastName.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

let rowCounter = 0;
function nextRowId() {
  rowCounter += 1;
  return `row-${rowCounter}`;
}

export function TripGroupModal({
  mode,
  isOpen,
  group,
  defaultName,
  onClose,
  onSubmit,
  onDelete
}: TripGroupModalProps) {
  const [name, setName] = useState('');
  const [members, setMembers] = useState<MemberDraft[]>([
    createEmptyMember(nextRowId()),
    createEmptyMember(nextRowId()),
    createEmptyMember(nextRowId())
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const initialMembers: MemberDraft[] =
      group?.members?.map((member) => ({
        id: member.id,
        rowId: nextRowId(),
        firstName: member.first_name ?? '',
        lastName: member.last_name ?? ''
      })) ?? [];

    const withMinimumRows =
      initialMembers.length >= 3
        ? initialMembers
        : [
            ...initialMembers,
            ...Array.from({ length: 3 - initialMembers.length }, () => createEmptyMember(nextRowId()))
          ];

    setName(group?.name ?? defaultName ?? '');
    setMembers(withMinimumRows);
    setError(null);
    setIsSubmitting(false);
    setIsDeleting(false);
  }, [group, defaultName, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const allFilled = members.every(
      (member) => (member.firstName?.trim() ?? '') || (member.lastName?.trim() ?? '')
    );

    if (allFilled) {
      setMembers((prev) => [...prev, createEmptyMember(nextRowId())]);
    }
  }, [members, isOpen]);

  const modalTitle = useMemo(() => {
    if (mode === 'create') {
      return 'Create trip group';
    }
    return group?.name ?? 'Edit trip group';
  }, [mode, group?.name]);

  if (!isOpen) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Group name is required.');
      return;
    }

    const normalizedMembers = dedupeMembers(
      normalizeMemberDrafts(members).map((member) => ({
        ...member,
        firstName: member.firstName,
        lastName: member.lastName
      }))
    );

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await onSubmit({
        name: trimmedName,
        members: normalizedMembers.map((member) => ({
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName
        }))
      });
      setIsSubmitting(false);
      onClose();
      return result;
    } catch (submissionError) {
      setIsSubmitting(false);
      if (submissionError instanceof Error) {
        setError(submissionError.message);
      } else {
        setError('Failed to save trip group.');
      }
    }
  }

  async function handleDelete() {
    if (mode !== 'edit' || !group?.id || !onDelete) {
      return;
    }

    if (!window.confirm('Delete this trip group? This cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      await onDelete(group.id);
      setIsDeleting(false);
      onClose();
    } catch (deleteError) {
      setIsDeleting(false);
      if (deleteError instanceof Error) {
        setError(deleteError.message);
      } else {
        setError('Failed to delete trip group.');
      }
    }
  }

  function updateMember(rowId: string, field: 'firstName' | 'lastName', value: string) {
    setMembers((prev) =>
      prev.map((member) =>
        member.rowId === rowId
          ? {
              ...member,
              [field]: value
            }
          : member
      )
    );
  }

  function removeMember(rowId: string) {
    setMembers((prev) => {
      const next = prev.filter((member) => member.rowId !== rowId);
      if (next.length === 0) {
        return [createEmptyMember(nextRowId()), createEmptyMember(nextRowId()), createEmptyMember(nextRowId())];
      }
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur">
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
      >
        <button
          type="button"
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white">{modalTitle}</h3>
            <p className="text-sm text-slate-400">
              Add the people who joined this trip. Names are unique within a group.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Trip group name
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={16}
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
            <p className="text-xs text-slate-500">{16 - name.trim().length} characters left</p>
          </div>
          <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
            {members.map((member) => {
              const hasFirst = Boolean(member.firstName?.trim());
              const hasLast = Boolean(member.lastName?.trim());
              const canRemove = Boolean(member.id) || hasFirst || hasLast;
              return (
                <div
                  key={member.rowId}
                  className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 md:grid-cols-[1fr,1fr,auto]"
                >
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      First name
                    </label>
                    <input
                      type="text"
                      value={member.firstName ?? ''}
                      onChange={(event) =>
                        updateMember(member.rowId, 'firstName', event.target.value)
                      }
                      placeholder="First name"
                      className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Last name
                    </label>
                    <input
                      type="text"
                      value={member.lastName ?? ''}
                      onChange={(event) => updateMember(member.rowId, 'lastName', event.target.value)}
                      placeholder="Last name"
                      className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                    />
                  </div>
                  <div className="flex items-start justify-end">
                    {canRemove ? (
                      <button
                        type="button"
                        className="mt-6 h-9 rounded-full border border-slate-800 px-4 text-xs font-medium uppercase tracking-wide text-slate-300 transition hover:text-white"
                        onClick={() => removeMember(member.rowId)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {mode === 'edit' ? (
            <p className="text-sm text-amber-200">
              Group changes will impact historical trips. Are you sure?
            </p>
          ) : null}
          <div className="flex flex-wrap justify-between gap-3">
            {mode === 'edit' && group?.id && onDelete ? (
              <Button
                type="button"
                variant="ghost"
                className="border border-red-500/40 text-red-300 hover:bg-red-500/10"
                onClick={handleDelete}
                disabled={isSubmitting || isDeleting}
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}


