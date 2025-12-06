'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TripGroupModal } from '@/features/trips/components/trip-group-modal';
import {
  useTripGroups,
  useCreateTripGroup,
  useUpdateTripGroup,
  useDeleteTripGroup
} from '@/features/trips/hooks';
import type { TripGroup } from '@/features/trips/types';
import type { TripGroupInput } from '@/features/trips/api';

export function TripGroupsSettings() {
  const { data: tripGroups, isLoading, error } = useTripGroups();
  const { mutateAsync: createTripGroupMutation } = useCreateTripGroup();
  const { mutateAsync: updateTripGroupMutation } = useUpdateTripGroup();
  const { mutateAsync: deleteTripGroupMutation } = useDeleteTripGroup();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [activeGroup, setActiveGroup] = useState<TripGroup | null>(null);

  function openCreateModal() {
    setModalMode('create');
    setActiveGroup(null);
    setIsModalOpen(true);
  }

  function openEditModal(group: TripGroup) {
    setModalMode('edit');
    setActiveGroup(group);
    setIsModalOpen(true);
  }

  async function handleModalSubmit(payload: TripGroupInput) {
    if (modalMode === 'edit' && activeGroup) {
      return updateTripGroupMutation({ groupId: activeGroup.id, payload });
    }
    return createTripGroupMutation(payload);
  }

  async function handleDelete(groupId: string) {
    await deleteTripGroupMutation({ groupId });
  }

  const sortedGroups = useMemo(() => {
    return (tripGroups ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [tripGroups]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Trip groups</h1>
          <p className="text-sm text-slate-400">
            Organize the people you travel with and reuse groups when creating trips.
          </p>
        </div>
        <Button type="button" onClick={openCreateModal}>
          <Plus className="mr-2 h-4 w-4" />
          New group
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
          Loading trip groups…
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">
          {error.message}
        </div>
      ) : sortedGroups.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
          No trip groups yet. Create your first group to start tracking who joins your adventures.
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Group name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Group members
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {sortedGroups.map((group) => {
                const memberSummary = group.members
                  ?.map((member) => {
                    const first = member.first_name ?? '';
                    const lastInitial = (member.last_name?.[0] ?? '').toUpperCase();
                    return lastInitial ? `${first} ${lastInitial}.` : first;
                  })
                  .filter(Boolean)
                  .join(', ');

                return (
                  <tr
                    key={group.id}
                    className="cursor-pointer transition hover:bg-slate-900/60"
                    onClick={() => openEditModal(group)}
                  >
                    <td className="max-w-xs px-4 py-3 text-sm font-medium text-white">{group.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      <div className="max-w-md truncate">{memberSummary || '—'}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <TripGroupModal
        mode={modalMode}
        isOpen={isModalOpen}
        group={modalMode === 'edit' ? activeGroup ?? undefined : undefined}
        defaultName={modalMode === 'create' ? '' : undefined}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        onDelete={
          modalMode === 'edit' && activeGroup ? (groupId) => handleDelete(groupId) : undefined
        }
      />
    </div>
  );
}


