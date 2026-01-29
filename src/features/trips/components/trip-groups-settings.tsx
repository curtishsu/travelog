'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TripGroupModal } from '@/features/trips/components/trip-group-modal';
import {
  useTripGroups,
  useCreateTripGroup,
  useUpdateTripGroup,
  useDeleteTripGroup,
  usePeople,
  useUpdatePerson,
  useDeletePerson
} from '@/features/trips/hooks';
import type { Person, TripGroup } from '@/features/trips/types';
import type { TripGroupInput } from '@/features/trips/api';

export function TripGroupsSettings() {
  const { data: tripGroups, isLoading, error } = useTripGroups();
  const { mutateAsync: createTripGroupMutation } = useCreateTripGroup();
  const { mutateAsync: updateTripGroupMutation } = useUpdateTripGroup();
  const { mutateAsync: deleteTripGroupMutation } = useDeleteTripGroup();
  const { data: people, isLoading: isPeopleLoading, error: peopleError } = usePeople();
  const { mutateAsync: updatePersonMutation } = useUpdatePerson();
  const { mutateAsync: deletePersonMutation } = useDeletePerson();

  const [settingsView, setSettingsView] = useState<'groups' | 'people'>('groups');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [activeGroup, setActiveGroup] = useState<TripGroup | null>(null);

  const [activePerson, setActivePerson] = useState<Person | null>(null);
  const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
  const [personFirstName, setPersonFirstName] = useState('');
  const [personLastName, setPersonLastName] = useState('');
  const [personGroupIds, setPersonGroupIds] = useState<string[]>([]);
  const [personModalError, setPersonModalError] = useState<string | null>(null);
  const [isPersonDeleting, setIsPersonDeleting] = useState(false);

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

  function openPersonModal(person: Person) {
    setActivePerson(person);
    setPersonFirstName(person.first_name ?? '');
    setPersonLastName(person.last_name ?? '');
    const groupsForPerson = (tripGroups ?? [])
      .filter((group) => group.members?.some((member) => member.id === person.id))
      .map((group) => group.id);
    setPersonGroupIds(groupsForPerson);
    setPersonModalError(null);
    setIsPersonModalOpen(true);
  }

  function closePersonModal() {
    setIsPersonModalOpen(false);
    setActivePerson(null);
    setPersonModalError(null);
  }

  async function handlePersonSave() {
    if (!activePerson) return;
    const nextFirst = personFirstName.trim();
    const nextLast = personLastName.trim() ? personLastName.trim() : null;
    if (!nextFirst) {
      setPersonModalError('First name is required.');
      return;
    }

    setPersonModalError(null);

    try {
      if (nextFirst !== activePerson.first_name || nextLast !== activePerson.last_name) {
        await updatePersonMutation({
          personId: activePerson.id,
          payload: { firstName: nextFirst, lastName: nextLast }
        });
      }

      const currentGroupIds = (tripGroups ?? [])
        .filter((group) => group.members?.some((member) => member.id === activePerson.id))
        .map((group) => group.id);

      const desired = new Set(personGroupIds);
      const current = new Set(currentGroupIds);
      const toRemove = currentGroupIds.filter((id) => !desired.has(id));
      const toAdd = personGroupIds.filter((id) => !current.has(id));

      for (const groupId of toRemove) {
        const group = (tripGroups ?? []).find((g) => g.id === groupId);
        if (!group) continue;
        await updateTripGroupMutation({
          groupId,
          payload: { members: (group.members ?? []).filter((m) => m.id !== activePerson.id).map((m) => ({ id: m.id })) }
        });
      }

      for (const groupId of toAdd) {
        const group = (tripGroups ?? []).find((g) => g.id === groupId);
        if (!group) continue;
        await updateTripGroupMutation({
          groupId,
          payload: { members: [...(group.members ?? []), activePerson].map((m) => ({ id: m.id })) }
        });
      }

      closePersonModal();
    } catch (error) {
      setPersonModalError(error instanceof Error ? error.message : 'Failed to save person.');
    }
  }

  async function handlePersonDelete() {
    if (!activePerson) return;

    const fullName = [activePerson.first_name, activePerson.last_name].filter(Boolean).join(' ') || 'this person';
    const confirmed = window.confirm(
      `Delete ${fullName}?\n\nThis will remove them from all trip groups and any trips where they were selected. This cannot be undone.`
    );
    if (!confirmed) return;

    setPersonModalError(null);
    setIsPersonDeleting(true);
    try {
      await deletePersonMutation({ personId: activePerson.id });
      setIsPersonDeleting(false);
      closePersonModal();
    } catch (error) {
      setIsPersonDeleting(false);
      setPersonModalError(error instanceof Error ? error.message : 'Failed to delete person.');
    }
  }

  const sortedGroups = useMemo(() => {
    return (tripGroups ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [tripGroups]);

  const sortedPeople = useMemo(() => {
    return (people ?? []).slice().sort((a, b) => {
      const aName = `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim().toLowerCase();
      const bName = `${b.first_name ?? ''} ${b.last_name ?? ''}`.trim().toLowerCase();
      return aName.localeCompare(bName);
    });
  }, [people]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Trip groups</h1>
          <p className="text-sm text-slate-400">
            Organize the people you travel with and reuse groups when creating trips.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-full border border-slate-800 bg-slate-950">
            <button
              type="button"
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                settingsView === 'groups' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:text-white'
              }`}
              onClick={() => setSettingsView('groups')}
            >
              Groups
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                settingsView === 'people' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:text-white'
              }`}
              onClick={() => setSettingsView('people')}
            >
              People
            </button>
          </div>
          {settingsView === 'groups' ? (
            <Button type="button" onClick={openCreateModal}>
              <Plus className="mr-2 h-4 w-4" />
              New group
            </Button>
          ) : null}
        </div>
      </div>

      {settingsView === 'groups' ? (
        isLoading ? (
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
      )
      ) : (
        isPeopleLoading ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
            Loading people…
          </div>
        ) : peopleError ? (
          <div className="rounded-3xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">
            {peopleError.message}
          </div>
        ) : sortedPeople.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
            No people yet. Add companions to a trip or create a group to get started.
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-800">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Groups
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/40">
                {sortedPeople.map((person) => {
                  const groupNames = (tripGroups ?? [])
                    .filter((group) => group.members?.some((member) => member.id === person.id))
                    .map((group) => group.name);
                  return (
                    <tr
                      key={person.id}
                      className="cursor-pointer transition hover:bg-slate-900/60"
                      onClick={() => openPersonModal(person)}
                    >
                      <td className="max-w-xs px-4 py-3 text-sm font-medium text-white">
                        {[person.first_name, person.last_name].filter(Boolean).join(' ')}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        <div className="max-w-md truncate">{groupNames.join(', ') || '—'}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
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

      {isPersonModalOpen && activePerson ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur">
          <div className="relative w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <button
              type="button"
              className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              onClick={closePersonModal}
              aria-label="Close"
            >
              <Plus className="h-4 w-4 rotate-45" />
            </button>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Edit person</h3>
              {personModalError ? <p className="text-sm text-red-300">{personModalError}</p> : null}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-400">First name</label>
                  <input
                    type="text"
                    value={personFirstName}
                    onChange={(event) => setPersonFirstName(event.target.value)}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Last name (optional)
                  </label>
                  <input
                    type="text"
                    value={personLastName}
                    onChange={(event) => setPersonLastName(event.target.value)}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Groups</label>
                <div className="flex flex-wrap gap-2">
                  {personGroupIds.length === 0 ? (
                    <p className="text-sm text-slate-500">No groups.</p>
                  ) : (
                    personGroupIds.map((groupId) => {
                      const group = (tripGroups ?? []).find((g) => g.id === groupId);
                      const name = group?.name ?? 'Unknown group';
                      return (
                        <span
                          key={groupId}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-medium text-slate-200"
                        >
                          {name}
                          <button
                            type="button"
                            onClick={() => setPersonGroupIds((prev) => prev.filter((id) => id !== groupId))}
                            className="rounded-full p-0.5 text-slate-300 hover:bg-slate-800 hover:text-white"
                            aria-label={`Remove from ${name}`}
                          >
                            <Plus className="h-3.5 w-3.5 rotate-45" />
                          </button>
                        </span>
                      );
                    })
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(tripGroups ?? [])
                    .filter((group) => !personGroupIds.includes(group.id))
                    .slice(0, 8)
                    .map((group) => (
                      <button
                        key={`add-${group.id}`}
                        type="button"
                        className="rounded-full border border-emerald-700/50 bg-emerald-900/10 px-3 py-1 text-xs font-medium text-emerald-200 transition hover:bg-emerald-900/20"
                        onClick={() => setPersonGroupIds((prev) => Array.from(new Set([...prev, group.id])))}
                      >
                        + {group.name}
                      </button>
                    ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="border border-red-500/40 text-red-300 hover:bg-red-500/10"
                  onClick={() => void handlePersonDelete()}
                  disabled={isPersonDeleting}
                >
                  {isPersonDeleting ? 'Deleting…' : 'Delete'}
                </Button>
                <Button type="button" variant="ghost" onClick={closePersonModal}>
                  Discard changes
                </Button>
                <Button type="button" onClick={() => void handlePersonSave()} disabled={isPersonDeleting}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


