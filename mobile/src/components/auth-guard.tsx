import { Redirect, useSegments } from 'expo-router';

import { LoadingBlock } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const inAuthGroup = segments[0] === 'auth';

  if (isLoading) {
    return <LoadingBlock />;
  }

  if (!session && !inAuthGroup) {
    return <Redirect href="/auth/sign-in" />;
  }

  if (session && inAuthGroup) {
    return <Redirect href="/" />;
  }

  return <>{children}</>;
}
