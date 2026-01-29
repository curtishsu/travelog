'use client';

import { useMutation, useQuery, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';

import {
  createTrip,
  deleteTrip,
  fetchTripDetail,
  fetchTripsList,
  removePhoto,
  updateTrip,
  updateTripDay,
  type TripDayUpdatePayload,
  type TripOverviewPayload,
  type TripUpdatePayload,
  fetchTripSuggestions,
  fetchStatsSummary,
  fetchTripGroups,
  createTripGroup,
  updateTripGroup,
  deleteTripGroup,
  type TripGroupInput,
  fetchPeople,
  createPerson,
  updatePerson,
  deletePerson,
  type PersonInput
} from '@/features/trips/api';
import type { TripDetail, TripGroup } from '@/features/trips/types';

const tripsListKey = ['trips'];
const tripDetailKey = (tripId: string) => ['trip', tripId];
const tripGroupsKey = ['trip-groups'];
const peopleKey = ['people'];

export function useTripsList() {
  return useQuery({
    queryKey: tripsListKey,
    queryFn: fetchTripsList
  });
}

export function useTripDetail(tripId: string, initialData?: TripDetail) {
  return useQuery({
    queryKey: tripDetailKey(tripId),
    queryFn: () => fetchTripDetail(tripId),
    enabled: Boolean(tripId),
    initialData
  });
}

export function useTripGroups() {
  return useQuery({
    queryKey: tripGroupsKey,
    queryFn: fetchTripGroups,
    staleTime: 1000 * 60 * 5
  });
}

export function usePeople() {
  return useQuery({
    queryKey: peopleKey,
    queryFn: fetchPeople,
    staleTime: 1000 * 60 * 5
  });
}

type CreateTripVariables = TripOverviewPayload;

export function useCreateTrip(
  options?: UseMutationOptions<
    Awaited<ReturnType<typeof createTrip>>,
    Error,
    CreateTripVariables
  >
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTrip,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: tripsListKey });
      options?.onSuccess?.(...args);
    },
    ...options
  });
}

type TripGroupVariables = TripGroupInput;

export function useCreateTripGroup(
  options?: UseMutationOptions<TripGroup, Error, TripGroupVariables>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTripGroup,
    onSuccess: async (group, variables, context, mutation) => {
      await queryClient.invalidateQueries({ queryKey: tripGroupsKey });
      options?.onSuccess?.(group, variables, context, mutation);
    },
    ...options
  });
}

type UpdateTripGroupVariables = { groupId: string; payload: Partial<TripGroupInput> };

export function useUpdateTripGroup(
  options?: UseMutationOptions<TripGroup, Error, UpdateTripGroupVariables>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, payload }) => updateTripGroup(groupId, payload),
    onSuccess: async (group, variables, context, mutation) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: tripGroupsKey }),
        queryClient.invalidateQueries({ queryKey: tripsListKey })
      ]);
      options?.onSuccess?.(group, variables, context, mutation);
    },
    ...options
  });
}

export function useDeleteTripGroup(
  options?: UseMutationOptions<void, Error, { groupId: string }>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId }) => deleteTripGroup(groupId),
    onSuccess: async (...args) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: tripGroupsKey }),
        queryClient.invalidateQueries({ queryKey: tripsListKey }),
        queryClient.invalidateQueries({ queryKey: ['trip'] })
      ]);
      options?.onSuccess?.(...args);
    },
    ...options
  });
}

type UpdateTripVariables = { tripId: string; payload: TripUpdatePayload };

export function useUpdateTrip(
  options?: UseMutationOptions<
    Awaited<ReturnType<typeof updateTrip>>,
    Error,
    UpdateTripVariables
  >
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, payload }: UpdateTripVariables) => updateTrip(tripId, payload),
    onSuccess: async (data, variables, context, mutation) => {
      queryClient.setQueryData(tripDetailKey(variables.tripId), data.trip);
      await queryClient.invalidateQueries({ queryKey: tripsListKey });
      options?.onSuccess?.(data, variables, context, mutation);
    },
    ...options
  });
}

type CreatePersonVariables = PersonInput;

export function useCreatePerson(options?: UseMutationOptions<Awaited<ReturnType<typeof createPerson>>, Error, CreatePersonVariables>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPerson,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: peopleKey });
      options?.onSuccess?.(...args);
    },
    ...options
  });
}

type UpdatePersonVariables = { personId: string; payload: Partial<PersonInput> };

export function useUpdatePerson(options?: UseMutationOptions<Awaited<ReturnType<typeof updatePerson>>, Error, UpdatePersonVariables>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ personId, payload }) => updatePerson(personId, payload),
    onSuccess: async (...args) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: peopleKey }),
        queryClient.invalidateQueries({ queryKey: tripGroupsKey }),
        queryClient.invalidateQueries({ queryKey: tripsListKey }),
        queryClient.invalidateQueries({ queryKey: ['trip'] })
      ]);
      options?.onSuccess?.(...args);
    },
    ...options
  });
}

export function useDeletePerson(
  options?: UseMutationOptions<void, Error, { personId: string }>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ personId }) => deletePerson(personId),
    onSuccess: async (...args) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: peopleKey }),
        queryClient.invalidateQueries({ queryKey: tripGroupsKey }),
        queryClient.invalidateQueries({ queryKey: tripsListKey }),
        queryClient.invalidateQueries({ queryKey: ['trip'] })
      ]);
      options?.onSuccess?.(...args);
    },
    ...options
  });
}

type UpdateTripDayVariables = { tripId: string; dayIndex: number; payload: TripDayUpdatePayload };

export function useUpdateTripDay(
  options?: UseMutationOptions<
    Awaited<ReturnType<typeof updateTripDay>>,
    Error,
    UpdateTripDayVariables
  >
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, dayIndex, payload }: UpdateTripDayVariables) =>
      updateTripDay(tripId, dayIndex, payload),
    onSuccess: (tripDay, variables, context, mutation) => {
      queryClient.setQueryData(tripDetailKey(variables.tripId), (prev: TripDetail | undefined) => {
        if (!prev) {
          return prev;
        }
        const nextDays = prev.trip_days.map((day) => (day.id === tripDay.id ? tripDay : day));
        return { ...prev, trip_days: nextDays };
      });
      options?.onSuccess?.(tripDay, variables, context, mutation);
    },
    ...options
  });
}

export function useDeleteTrip(
  options?: UseMutationOptions<void, Error, { tripId: string }>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId }) => deleteTrip(tripId),
    onSuccess: async (...args) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: tripsListKey }),
        queryClient.removeQueries({ queryKey: tripsListKey }),
        queryClient.removeQueries({ queryKey: ['trip'] })
      ]);
      options?.onSuccess?.(...args);
    },
    ...options
  });
}

export function useDeletePhoto(
  options?: UseMutationOptions<void, Error, { tripId: string; tripDayId: string; photoId: string }>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ photoId }) => removePhoto(photoId),
    onSuccess: (_, variables, context, mutation) => {
      queryClient.setQueryData(tripDetailKey(variables.tripId), (prev: TripDetail | undefined) => {
        if (!prev) {
          return prev;
        }
        const nextDays = prev.trip_days.map((day) => {
          if (day.id === variables.tripDayId) {
            return { ...day, photos: day.photos.filter((photo) => photo.id !== variables.photoId) };
          }
          return day;
        });
        return { ...prev, trip_days: nextDays };
      });
      options?.onSuccess?.(_, variables, context, mutation);
    },
    ...options
  });
}

export function useTripSuggestions() {
  return useQuery({
    queryKey: ['trip-suggestions'],
    queryFn: fetchTripSuggestions,
    staleTime: 1000 * 60 * 5
  });
}

export function useStatsSummary() {
  return useQuery({
    queryKey: ['stats-summary'],
    queryFn: fetchStatsSummary,
    staleTime: 1000 * 60
  });
}

