import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button, Card, Field, Screen, Segmented } from '@/components';
import { createAccount, signInWithPassword } from '@/data';
import { colors } from '@/theme';

type Mode = 'signin' | 'create';

function friendly(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/invalid login credentials/i.test(msg)) return 'That email and password do not match. Check them and try again.';
  if (/already registered|already exists/i.test(msg)) return 'There is already an account with that email. Choose "Sign in" instead.';
  if (/password should be|weak password/i.test(msg)) return 'Please choose a longer password (at least 8 characters).';
  if (/email not confirmed/i.test(msg)) return 'This account is waiting for email confirmation. Ask Greg to switch off "Confirm email" in Supabase.';
  if (/rate limit|too many/i.test(msg)) return 'Too many tries. Please wait a minute and try again.';
  if (/network|fetch|offline/i.test(msg)) return 'No internet connection. Please check and try again.';
  return msg;
}

export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const passwordOk = password.length >= 8;

  async function submit() {
    if (!emailOk) return setError('Please enter your email address.');
    if (!passwordOk) return setError('Passwords need at least 8 characters.');
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') {
        await signInWithPassword(email, password);
      } else {
        const signedIn = await createAccount(email, password);
        if (!signedIn) {
          setError('Account created, but Supabase wants the email confirmed first. Ask Greg to switch off "Confirm email" in Supabase, then sign in.');
          setMode('signin');
        }
      }
      // On success the session arrives through onAuthStateChange and the app moves on by itself.
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Resale Tracker" bottomInset>
      <Text style={styles.lead}>
        {mode === 'signin'
          ? 'Sign in with your email and password. You stay signed in on this device.'
          : 'First time here? Create your account with your email and a password of at least 8 characters.'}
      </Text>
      <Segmented
        options={[
          { value: 'signin', label: 'Sign in' },
          { value: 'create', label: 'Create account' },
        ]}
        value={mode}
        onChange={(m) => {
          setMode(m as Mode);
          setError(null);
        }}
      />
      <Card>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          autoCorrect={false}
          returnKeyType="next"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          textContentType={mode === 'signin' ? 'password' : 'newPassword'}
          returnKeyType="go"
          onSubmitEditing={submit}
          error={error}
        />
        <Button
          label={mode === 'signin' ? 'Sign in' : 'Create account'}
          onPress={submit}
          loading={busy}
          disabled={!email.trim() || !password}
        />
      </Card>
      <Text style={styles.note}>Forgotten your password? Ask Greg to reset it for you.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 15, lineHeight: 22, color: colors.ink2, marginHorizontal: 4, marginBottom: 16 },
  note: { fontSize: 13, color: colors.ink2, marginHorizontal: 4, marginTop: 12 },
});
