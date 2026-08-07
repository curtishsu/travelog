import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button, Card, InputField, Screen, SectionTitle } from '@/components/ui';
import { createTrip } from '@/lib/repository';

export default function NewTripScreen() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tripTypes, setTripTypes] = useState('');
  const [reflection, setReflection] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    setWarning(null);
    try {
      const result = await createTrip({
        name,
        startDate,
        endDate,
        reflection,
        tripTypes: tripTypes.split(',').map((value) => value.trim()).filter(Boolean),
      });
      if (result.overlapWarning?.message) {
        setWarning(result.overlapWarning.message);
      }
      await queryClient.invalidateQueries({ queryKey: ['trips'] });
      router.replace({
        pathname: '/trips/[tripId]/edit',
        params: { tripId: result.tripId, tab: 'day-1' },
      });
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Screen>
      <SectionTitle title="Add trip" subtitle="Start with dates and trip types. You can fill in the days next." />
      <Card>
        <InputField label="Trip name" value={name} onChangeText={setName} placeholder="Japan Spring 2025" />
        <InputField label="Start date" value={startDate} onChangeText={setStartDate} placeholder="2025-04-01" />
        <InputField label="End date" value={endDate} onChangeText={setEndDate} placeholder="2025-04-12" />
        <InputField label="Trip types" value={tripTypes} onChangeText={setTripTypes} placeholder="family, city, food" />
        <InputField label="Reflection (optional)" value={reflection} onChangeText={setReflection} multiline />
        {warning ? <Text style={{ color: '#fde68a' }}>{warning}</Text> : null}
        {error ? <Text style={{ color: '#fecaca' }}>{error}</Text> : null}
        <Button label={isSaving ? 'Saving...' : 'Save trip'} onPress={handleSave} disabled={isSaving} />
      </Card>
    </Screen>
  );
}
