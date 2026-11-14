import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button, Card, Field, Screen } from '@/components';
import { sendEmailCode, verifyEmailCode } from '@/data';
import { colors } from '@/theme';

function friendly(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/rate limit|too many/i.test(msg)) return 'Too many tries. Please wait a minute and try again.';
  if (/invalid|expired|token/i.test(msg)) return 'That code did not work. Check it and try again, or ask for a new one.';
  if (/network|fetch|offline/i.test(msg)) return 'No internet connection. Please check and try again.';
  return msg;
}

export default function SignInScreen() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());

  async function sendCode() {
    if (!emailOk) {
      setError('Please enter your email address.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendEmailCode(email);
      setStep('code');
      setCode('');
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      await verifyEmailCode(email, code);
      // The session arrives through onAuthStateChange and the app moves on by itself.
    } catch (e) {
      setError(friendly(e));
      setBusy(false);
    }
  }

  return (
    <Screen title="Resale Tracker" bottomInset>
      <Text style={styles.lead}>
        {step === 'email'
          ? 'Sign in with your email. We will send you a short code, so there is no password to remember.'
          : `We sent a code to ${email.trim()}. It can take a minute to arrive. Check your junk folder too.`}
      </Text>
      <Card>
        {step === 'email' ? (
          <>
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
              returnKeyType="go"
              onSubmitEditing={sendCode}
              error={error}
            />
            <Button label="Email me a code" onPress={sendCode} loading={busy} disabled={!email.trim()} />
          </>
        ) : (
          <>
            <Field
              label="Code from the email"
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 8))}
              placeholder="123456"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={8}
              returnKeyType="go"
              onSubmitEditing={verify}
              error={error}
            />
            <Button label="Sign in" onPress={verify} loading={busy} disabled={code.length < 6} />
            <Button
              label="Use a different email"
              variant="secondary"
              onPress={() => {
                setStep('email');
                setError(null);
              }}
            />
            <Button label="Send a new code" variant="secondary" onPress={sendCode} disabled={busy} />
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 15, lineHeight: 22, color: colors.ink2, marginHorizontal: 4, marginBottom: 16 },
});
