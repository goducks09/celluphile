import React, { Suspense } from 'react';
import Navigation from '@/app/ui/navigation';
import { auth, signOut } from '@/auth';

async function NavigationWithAuth() {
    const session = await auth();

    async function handleSignOut() {
        'use server';
        await signOut({ redirectTo: '/login' });
    }

    return (
        <Navigation
            email={session?.user?.email}
            signOutAction={handleSignOut}
        />
    );
}

function NavigationSkeleton() {
    return (
        <header className="nav-header">
            <div className="nav-header-inner">
                <div className="flex items-center gap-4">
                    <h1 className="dashboard-brand">CELLU<span className="dashboard-brand-dot">●</span>PHILE</h1>
                </div>
                <div className="nav-actions">
                    <div className="w-6 h-6" />
                </div>
            </div>
        </header>
    );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen pb-12" style={{ background: 'var(--background)' }}>
            <Suspense fallback={<NavigationSkeleton />}>
                <NavigationWithAuth />
            </Suspense>
            <div id="main-content">
                {children}
            </div>
        </div>
    );
}
