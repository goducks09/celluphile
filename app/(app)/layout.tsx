import React from 'react';
import Navigation from '@/app/ui/navigation';
import { auth, signOut } from '@/auth';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();

    async function handleSignOut() {
        'use server';
        await signOut({ redirectTo: '/login' });
    }

    return (
        <div className="min-h-screen pb-12" style={{ background: 'var(--background)' }}>
            <Navigation
                email={session?.user?.email}
                signOutAction={handleSignOut}
            />
            <div id="main-content">
                {children}
            </div>
        </div>
    );
}
