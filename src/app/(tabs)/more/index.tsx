import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button, Field, ListGroup, Row, Screen, SectionTitle, Sheet } from '@/components';
import { useAddMember, useBusinessData, useSession } from '@/data';
import { useAiUsageToday } from '@/data/ai';
import { formatMoney, sumMoney } from '@/domain';
import { addMemberErrorText, isLikelyEmail } from '@/features/more/forms';
import { SharedWithSection } from '@/features/more/members';
import { ConfirmSheet, ErrorText, Note } from '@/features/more/ui';
import { colors } from '@/theme';
import { versionText } from '@/lib/version';

export default function MoreScreen() {
  const { data } = useBusinessData();
  const { email, demo, signOut } = useSession();
  const aiUsage = useAiUsageToday();
  const [shareOpen, setShareOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const activeShops = data.shops.filter((s) => !s.archived).length;
  const spent = sumMoney(data.expenses.map((e) => e.amount));

  const doSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
      setSignOutOpen(false);
    }
  };

  return (
    <Screen title="More">
      <SectionTitle>Lists</SectionTitle>
      <ListGroup>
        <Row title="Shops" subtitle={`${activeShops} regular ${activeShops === 1 ? 'shop' : 'shops'}`} onPress={() => router.push('/more/shops')} />
        <Row title="SKU codes and storage" subtitle="e.g. WDR = women's dress → Rack A" onPress={() => router.push('/more/sku-codes')} />
      </ListGroup>

      <SectionTitle>Money</SectionTitle>
      <ListGroup>
        <Row
          title="Expenses"
          subtitle={`Satchels, tissue paper, tape, pens… · ${formatMoney(spent)} so far`}
          onPress={() => router.push('/more/expenses')}
        />
        <Row
          title="AI helpers"
          subtitle={
            aiUsage.isError
              ? 'Could not check'
              : `${aiUsage.used} used today of ${aiUsage.cap}${aiUsage.used >= aiUsage.cap ? '. All used, they reset tomorrow' : ''}${demo ? ' (demo)' : ''}`
          }
        />
        <Row title="Fee settings" subtitle="Buyer protection, ad rate, postage label" onPress={() => router.push('/more/fees')} />
      </ListGroup>

      <SectionTitle>Connections</SectionTitle>
      <ListGroup>
        <Row title="eBay account" subtitle="Not connected · coming later" />
        <Row title="Depop" subtitle="Later" />
      </ListGroup>

      <SectionTitle>Data</SectionTitle>
      <ListGroup>
        <Row title="Load your sales history" subtitle="Everything from the start, including your own clothes" onPress={() => router.push('/more/import')} />
        <Row title="Tax-year report" subtitle="July–June summary and CSV for your accountant" onPress={() => router.push('/more/tax')} />
        <Row title="Export everything (CSV)" subtitle="All items, sales, expenses and trips" onPress={() => router.push('/more/export')} />
        <Row title="Sync and backup" subtitle={demo ? 'Demo data stays on this device' : 'iPhone and iPad stay in sync automatically'} />
      </ListGroup>

      <SharedWithSection demo={demo} onAdd={() => setShareOpen(true)} />

      <SectionTitle>Account</SectionTitle>
      <ListGroup>
        {demo ? (
          <Row title="Demo mode" subtitle="Sample data on this device. Nothing is sent to a server." />
        ) : (
          <Row title="Signed in as" subtitle={email ?? 'Unknown'} />
        )}
        <Row title="App version" subtitle={versionText()} />
      </ListGroup>
      {demo ? null : <Button label="Sign out" variant="danger" onPress={() => setSignOutOpen(true)} />}

      <AddMemberSheet visible={shareOpen} onClose={() => setShareOpen(false)} />
      <ConfirmSheet
        visible={signOutOpen}
        title="Sign out?"
        message="You will need your email to sign in again. Your data stays safe in your account."
        confirmLabel="Sign out"
        busy={signingOut}
        onConfirm={doSignOut}
        onCancel={() => setSignOutOpen(false)}
      />
    </Screen>
  );
}

function AddMemberSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const add = useAddMember();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const close = () => {
    setError(null);
    setDone(null);
    setEmail('');
    onClose();
  };

  const submit = async () => {
    setError(null);
    setDone(null);
    if (!isLikelyEmail(email)) {
      setError("That does not look like an email address. Use the email Damon signs in with.");
      return;
    }
    try {
      await add.mutateAsync({ email });
      void qc.invalidateQueries({ queryKey: ['members'] });
      setDone(`Added. ${email.trim()} can now see and edit this business.`);
      setEmail('');
    } catch (e) {
      setError(addMemberErrorText(e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <Sheet visible={visible} onClose={close} title="Add Damon">
      <Note>
        Damon needs to open the app and sign in with his email once first. Then enter that same email here and he will see the same items, sales and expenses.
      </Note>
      <Field
        label="Damon's email"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          setError(null);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="damon@example.com"
      />
      <ErrorText>{error}</ErrorText>
      {done ? <Text style={{ fontSize: 14, color: colors.accent, marginBottom: 10 }} accessibilityLiveRegion="polite">{done}</Text> : null}
      <Button label="Add Damon" loading={add.isPending} onPress={submit} />
      <Button label={done ? 'Done' : 'Cancel'} variant="secondary" onPress={close} />
    </Sheet>
  );
}
