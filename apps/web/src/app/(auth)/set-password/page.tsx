import { Suspense } from 'react';
import { SetPasswordPage } from '@/features/auth';

export default function SetPassword() {
  return (
    <Suspense>
      <SetPasswordPage />
    </Suspense>
  );
}
