import { Redirect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { LoadingBlock } from '@/components/ui';
import { getLandingRedirect } from '@/lib/repository';

export default function IndexScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['landing-redirect'],
    queryFn: getLandingRedirect,
  });

  if (isLoading || !data) {
    return <LoadingBlock />;
  }

  return <Redirect href={data as never} />;
}
