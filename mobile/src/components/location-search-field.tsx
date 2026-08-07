import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { searchLocations } from '@/lib/location-search';
import { LocationSuggestion } from '@/lib/types';
import { colors, InputField, styles } from '@/components/ui';

export function LocationSearchField({
  onSelect,
}: {
  onSelect: (location: LocationSuggestion) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setError(null);
        setResults(await searchLocations(trimmed));
      } catch (searchError) {
        setError((searchError as Error).message);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <View style={{ gap: 8 }}>
      <InputField
        label="Search location"
        value={query}
        onChangeText={setQuery}
        placeholder="Tokyo, Lisbon, New York..."
      />
      {error ? <Text style={{ color: '#fecaca' }}>{error}</Text> : null}
      {results.map((result) => (
        <Pressable
          key={result.id}
          onPress={() => {
            onSelect(result);
            setQuery('');
            setResults([]);
          }}
          style={[
            styles.card,
            { paddingVertical: 12, backgroundColor: colors.cardAlt },
          ]}
        >
          <Text style={{ color: colors.text, fontWeight: '700' }}>{result.displayName}</Text>
          <Text style={{ color: colors.muted }}>{[result.city, result.region, result.country].filter(Boolean).join(', ')}</Text>
        </Pressable>
      ))}
    </View>
  );
}
