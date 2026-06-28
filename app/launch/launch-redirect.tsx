'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Client component that navigates away from the splash page once
 * React has hydrated. Uses `replace` so the splash page is not
 * left in the browser history stack.
 *
 * - Authenticated users → middleware allows /dashboard through.
 * - Unauthenticated users → middleware redirects to /login.
 *
 * In both cases the branded splash stays visible on screen until
 * the target page is ready to paint.
 */
export default function LaunchRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return null;
}
