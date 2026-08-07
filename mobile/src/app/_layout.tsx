import { Stack } from 'expo-router';

import { AuthGuard } from '@/components/auth-guard';
import { AuthProvider } from '@/lib/auth';
import { MobileQueryProvider } from '@/lib/query';

export default function RootLayout() {
  return (
    <MobileQueryProvider>
      <AuthProvider>
        <AuthGuard>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#0f172a' },
            }}
          />
        </AuthGuard>
      </AuthProvider>
    </MobileQueryProvider>
  );
}
