import { useGetCurrentUser, getGetCurrentUserQueryKey } from '@workspace/api-client-react';
import { LoaderCircle } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { LoginPage } from '../../pages/Login';
import { AppShell } from './AppShell';

export function AuthGate({ children }: { children: (user: any) => React.ReactNode }) {
  const session = useGetCurrentUser({
    query: {
      queryKey: getGetCurrentUserQueryKey(),
      retry: false,
      staleTime: Infinity,
    },
  });
  
  if (session.isPending) {
    return (
      <div className="splash" dir="rtl">
        <BrandMark />
        <LoaderCircle className="spin" />
      </div>
    );
  }
  
  if (!session.data) {
    return <LoginPage />;
  }
  
  return <AppShell user={session.data}>{children(session.data)}</AppShell>;
}
