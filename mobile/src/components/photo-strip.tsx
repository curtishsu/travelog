import { Image, Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Card, colors } from '@/components/ui';
import { TripPhoto } from '@/lib/types';

export function PhotoStrip({
  photos,
  onDelete,
}: {
  photos: TripPhoto[];
  onDelete?: (photo: TripPhoto) => void;
}) {
  if (!photos.length) {
    return null;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
      {photos.map((photo) => (
        <Card key={photo.id}>
          <Image
            source={{ uri: photo.thumbnail_url }}
            style={{ width: 96, height: 96, borderRadius: 12, backgroundColor: colors.cardAlt }}
          />
          {onDelete ? (
            <Button label="Delete" variant="danger" onPress={() => onDelete(photo)} />
          ) : null}
          {!onDelete ? (
            <Pressable onPress={() => undefined}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Photo</Text>
            </Pressable>
          ) : null}
        </Card>
      ))}
    </ScrollView>
  );
}
