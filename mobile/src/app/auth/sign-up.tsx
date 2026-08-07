import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button, Card, InputField, Screen, SectionTitle, colors } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    setIsSubmitting(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session) {
      router.replace('/');
      return;
    }
    setSuccess('Account created. Confirm your email, then sign in.');
  }

  return (
    <Screen>
      <SectionTitle title="Create your account" subtitle="Keep every trip in one place." />
      <Card>
        <InputField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" />
        <InputField label="Password" value={password} onChangeText={setPassword} placeholder="Password" />
        <InputField label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" />
        {error ? <Text style={{ color: '#fecaca' }}>{error}</Text> : null}
        {success ? <Text style={{ color: '#bbf7d0' }}>{success}</Text> : null}
        <Button label={isSubmitting ? 'Creating account...' : 'Sign up'} onPress={handleSubmit} disabled={isSubmitting} />
        <Link href="/auth/sign-in" style={{ color: colors.muted }}>
          Already have an account? Sign in
        </Link>
      </Card>
    </Screen>
  );
}
