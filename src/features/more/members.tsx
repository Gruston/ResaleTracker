import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ListGroup, Row, SectionTitle } from '@/components';
import { useMembers, useRemoveMember, type Member } from '@/data';
import { ConfirmSheet, Note } from '@/features/more/ui';

export function removeMemberErrorText(message: string): string {
  if (/only the owner/i.test(message)) return 'Only the owner can remove people.';
  if (/themselves|cannot be removed/i.test(message)) return 'The owner cannot be removed.';
  return `Could not remove them. ${message}`;
}

/** More › Shared with: members (email + Owner/Member) and an Add row. Owner can tap a member to remove them. */
export function SharedWithSection({ demo, onAdd }: { demo: boolean; onAdd: () => void }) {
  const { members, isLoading, isError, isOwner, refetch } = useMembers();
  const remove = useRemoveMember();
  const qc = useQueryClient();
  const [target, setTarget] = useState<Member | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setTarget(null);
    setError(null);
  };
  const confirm = async () => {
    if (!target) return;
    setError(null);
    try {
      await remove.mutateAsync({ userId: target.userId });
      close();
    } catch (e) {
      setError(removeMemberErrorText(e instanceof Error ? e.message : String(e)));
    }
  };

  const label = (m: Member) => (demo ? `${m.email} (owner)` : m.email);

  return (
    <>
      <SectionTitle>Shared with</SectionTitle>
      <ListGroup>
        {isLoading ? (
          <Row title="Loading…" />
        ) : isError ? (
          <Row title="Could not load the list" subtitle="Tap to try again" onPress={() => void refetch()} />
        ) : (
          members.map((m) => {
            const removable = isOwner && m.role !== 'owner';
            return (
              <Row
                key={m.userId}
                title={label(m)}
                right={demo ? undefined : m.role === 'owner' ? 'Owner' : 'Member'}
                subtitle={removable ? 'Tap to remove' : undefined}
                chevron={false}
                onPress={removable ? () => setTarget(m) : undefined}
                accessibilityLabel={
                  removable ? `${m.email}, Member. Remove from this business` : `${m.email}, ${m.role === 'owner' ? 'Owner' : 'Member'}`
                }
              />
            );
          })
        )}
        <Row
          title="Add Damon"
          subtitle={demo ? 'Not available in demo mode' : 'Optional: share this business with Damon'}
          onPress={demo ? undefined : onAdd}
        />
      </ListGroup>
      {demo || isOwner || isLoading || isError ? null : <Note>Only the owner can add or remove people.</Note>}

      <ConfirmSheet
        visible={!!target}
        title="Remove this person?"
        message={`${target?.email ?? 'They'} will no longer be able to see or edit this business. Your items, sales and expenses are not deleted. You can add them again later.`}
        confirmLabel="Remove"
        busy={remove.isPending}
        error={error}
        onConfirm={confirm}
        onCancel={close}
      />
    </>
  );
}
