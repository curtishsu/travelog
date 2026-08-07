import { Tabs } from 'expo-router';

import { colors } from '@/components/ui';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="journal" options={{ title: 'Journal' }} />
      <Tabs.Screen name="quick-add" options={{ title: 'Quick Add' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
