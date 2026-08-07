import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button, Card, InputField, Screen, SectionTitle, colors } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.replace('/');
  }

  return (
    <Screen>
      <SectionTitle title="Welcome back" subtitle="Sign in to continue journaling your travels." />
      <Card>
        <InputField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" />
        <InputField label="Password" value={password} onChangeText={setPassword} placeholder="Password" />
        {error ? <Text style={{ color: '#fecaca' }}>{error}</Text> : null}
        <Button label={isSubmitting ? 'Signing in...' : 'Sign in'} onPress={handleSubmit} disabled={isSubmitting} />
        <Link href="/auth/sign-up" style={{ color: colors.muted }}>
          No account yet? Sign up
        </Link>
      </Card>
    </Screen>
  );
}
