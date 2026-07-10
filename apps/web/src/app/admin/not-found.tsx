import { NotFound } from '@/components/shared/NotFound';
import { DEFAULT_REDIRECT_HOME } from '@/lib/auth/navigation';

export default function AdminNotFoundPage() {
  return <NotFound home={DEFAULT_REDIRECT_HOME} />;
}
