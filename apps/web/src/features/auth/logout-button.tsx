'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { Button } from '../../components/ui/index';

import { authKeys, logout } from './auth.api';

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 17l5-5-5-5M15 12H3M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    </svg>
  );
}

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      // Clear any cached authenticated data so stale user/file info never lingers client-side.
      queryClient.removeQueries({ queryKey: authKeys.me });
      await queryClient.invalidateQueries();
      router.push('/');
      router.refresh();
    },
  });

  return (
    <Button
      variant="secondary"
      className={className}
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
    >
      <LogoutIcon />
      {mutation.isPending ? 'Logging out...' : 'Log out'}
    </Button>
  );
}
