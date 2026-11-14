import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button, Card, Field, Screen } from '@/components';
import { useCreateBusiness, useSession } from '@/data';
import { colors } from '@/theme';

export default function SetupScreen() {
  const [name, setName] = useState("Kat's Resale");
  const create = useCreateBusiness();
  const { signOut, email } = useSession();

  return (
    <Screen title="Create your business" bottomInset>
      <Text style={styles.lead}>
        This is where your trips, items and sales are kept. You can change the name later. Signed in as {email ?? 'you'}.
      </Text>
      <Card>
        <Field
          label="Business name"
          value={name}
          onChangeText={setName}
          returnKeyType="go"
          onSubmitEditing={() => name.trim() && create.mutate(name)}
          error={create.error ? create.error.message : null}
        />
        <Button
          label="Create business"
          onPress={() => create.mutate(name)}
          loading={create.isPending}
          disabled={!name.trim()}
        />
      </Card>
      <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 15, lineHeight: 22, color: colors.ink2, marginHorizontal: 4, marginBottom: 16 },
});
