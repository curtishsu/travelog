import { useMutation, useQuery, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';

import { fetchGuestModeSettings, updateGuestModeSettings } from '@/features/settings/api';

const guestModeSettingsKey = ['guest-mode-settings'];

export function useGuestModeSettings() {
  return useQuery({
    queryKey: guestModeSettingsKey,
    queryFn: fetchGuestModeSettings
  });
}

type UpdateGuestModeVariables = {
  guestModeEnabled: boolean;
  password?: string;
};

export function useUpdateGuestModeSettings(
  options?: UseMutationOptions<
    Awaited<ReturnType<typeof updateGuestModeSettings>>,
    Error,
    UpdateGuestModeVariables
  >
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: UpdateGuestModeVariables) => updateGuestModeSettings(variables),
    onSuccess: async (data, variables, context, mutation) => {
      queryClient.setQueryData(guestModeSettingsKey, data);
      options?.onSuccess?.(data, variables, context, mutation);
    },
    ...options
  });
}


