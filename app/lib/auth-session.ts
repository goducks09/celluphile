import 'server-only';
import { auth } from '@/auth';

/**
 * Cached session reader for Server Components.
 * Scoped to the client's private cache so request headers/cookies are not
 * re-evaluated across instant client navigations, while ensuring no session
 * data is ever stored in a shared server-side cache.
 */
export async function getSession() {
    'use cache: private';
    return await auth();
}
