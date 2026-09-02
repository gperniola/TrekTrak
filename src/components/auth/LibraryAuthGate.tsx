'use client';

import { useAuthStore } from '@/stores/authStore';
import { RequestAccessForm } from './RequestAccessForm';
import { ChooseUsername } from './ChooseUsername';
import { UserHeader } from './UserHeader';

export function LibraryAuthGate({ children }: { children: React.ReactNode }) {
  const loading = useAuthStore((s) => s.loading);
  const session = useAuthStore((s) => s.session);
  const member = useAuthStore((s) => s.member);

  if (loading) return <div className="p-4 text-xs text-gray-400">Caricamento…</div>;
  if (!session) return <RequestAccessForm />;
  if (!member) return <ChooseUsername />;
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <UserHeader />
      {children}
    </div>
  );
}
