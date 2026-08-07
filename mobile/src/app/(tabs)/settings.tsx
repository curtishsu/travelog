import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from 'react-native';

import { Button, Card, ErrorCard, LoadingBlock, Screen, SectionTitle } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { getGuestModeSettings, setGuestModeSettings } from '@/lib/repository';

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['guest-mode-settings'],
    queryFn: getGuestModeSettings,
  });

  async function toggleGuestMode() {
    await setGuestModeSettings(!(data?.guestModeEnabled ?? false));
    await queryClient.invalidateQueries({ queryKey: ['guest-mode-settings'] });
  }

  return (
    <Screen>
      <SectionTitle title="Settings" subtitle="Privacy controls and mobile account basics." />
      {isLoading ? <LoadingBlock /> : null}
      {error ? <ErrorCard message={(error as Error).message} onRetry={() => refetch()} /> : null}
      {!isLoading && !error ? (
        <Card>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>Guest Mode</Text>
          <Text style={{ color: '#94a3b8' }}>
            {data?.guestModeEnabled
              ? 'Private reflections, journals, and photos are hidden in supported views.'
              : 'Private content remains visible.'}
          </Text>
          <Button
            label={data?.guestModeEnabled ? 'Turn off Guest Mode' : 'Enable Guest Mode'}
            onPress={toggleGuestMode}
          />
        </Card>
      ) : null}
      <Card>
        <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>Session</Text>
        <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
      </Card>
    </Screen>
  );
}
