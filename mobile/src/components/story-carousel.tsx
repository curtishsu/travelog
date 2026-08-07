import { ScrollView, Text, View } from 'react-native';

import { Card, colors } from '@/components/ui';
import { TripDayWithRelations } from '@/lib/types';

export function StoryCarousel({ days }: { days: TripDayWithRelations[] }) {
  const stories = days.flatMap((day) =>
    day.trip_day_paragraphs
      .filter((paragraph) => paragraph.is_story)
      .map((paragraph) => ({
        id: paragraph.id,
        text: paragraph.text,
        dayIndex: day.day_index,
        location: day.trip_locations[0]?.display_name ?? null,
      })),
  );

  if (!stories.length) {
    return null;
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>Stories</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {stories.map((story) => (
          <Card key={story.id}>
            <Text style={{ color: colors.text, width: 240, fontSize: 16, fontWeight: '600' }} numberOfLines={4}>
              {story.text}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 8 }}>
              Day {story.dayIndex}
              {story.location ? ` - ${story.location}` : ''}
            </Text>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
