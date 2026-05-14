'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLinkStatus } from 'next/link';
import { ArrowLeftIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

function NavLink({ href, children, onNavigate }: { href: string; children: React.ReactNode; onNavigate?: () => void }) {
    const [active, setActive] = useState(false);

    return (
        <Link 
            href={href} 
            onClick={onNavigate} 
            prefetch={active ? null : false}
            onMouseEnter={() => setActive(true)}
            onTouchStart={() => setActive(true)}
            className="nav-link relative flex items-center"
        >
            <span className="flex items-center gap-2">{children}</span>
            <LoadingIndicator />
        </Link>
    );
}

function LoadingIndicator() {
    const { pending } = useLinkStatus();
    
    // Always render the SVG to prevent DOM mismatch during hydration.
    // Use CSS opacity and transition delay to debounce the loading state.
    return (
        <svg 
            className={`animate-spin h-4 w-4 text-accent absolute right-4 transition-opacity duration-200 ${pending ? 'opacity-100 delay-100' : 'opacity-0'}`} 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    );
}

export default function Navigation({ email, signOutAction }: { email?: string | null; signOutAction: () => Promise<void> }) {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const pathname = usePathname();

    const isDashboardRoot = pathname === '/dashboard';

    const upHref = pathname.startsWith('/dashboard/library/') && pathname !== '/dashboard/library'
        ? '/dashboard/library'
        : '/dashboard';

    const closeDrawer = () => setDrawerOpen(false);

    return (
        <>
            <header className="nav-header">
                <div className="nav-header-inner">
                    <div className="flex items-center gap-4">
                        {!isDashboardRoot && (
                            <Link href={upHref} className="nav-btn" aria-label="Go Back">
                                <ArrowLeftIcon className="h-5 w-5" />
                            </Link>
                        )}
                        <h1 className="dashboard-brand">CELLU<span className="dashboard-brand-dot">●</span>PHILE</h1>
                    </div>

                    <div className="nav-actions">
                        <button onClick={() => setDrawerOpen(true)} className="nav-btn" aria-label="Open Menu">
                            <Bars3Icon className="h-6 w-6" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Overlay */}
            <div
                className={`nav-overlay ${drawerOpen ? 'nav-overlay--open' : ''}`}
                onClick={closeDrawer}
                aria-hidden="true"
            />

            {/* Drawer */}
            <div className={`nav-drawer ${drawerOpen ? 'nav-drawer--open' : ''}`}>
                <div className="nav-drawer-header">
                    <button onClick={closeDrawer} className="nav-btn" aria-label="Close Menu">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                <nav className="nav-links">
                    <NavLink href="/dashboard" onNavigate={closeDrawer}>Dashboard</NavLink>
                    <NavLink href="/dashboard/library" onNavigate={closeDrawer}>Library</NavLink>
                    <NavLink href="/dashboard/wishlist" onNavigate={closeDrawer}>Wishlist</NavLink>
                    <NavLink href="/dashboard/random" onNavigate={closeDrawer}>Random Movie</NavLink>
                    <NavLink href="/dashboard/recommendations" onNavigate={closeDrawer}>Recommendations</NavLink>
                </nav>

                <div className="nav-user-section">
                    <span className="nav-email font-medium pb-2 text-sm">{email}</span>
                    <form action={signOutAction} onSubmit={closeDrawer}>
                        <button type="submit" className="dashboard-sign-out-btn w-full text-center">
                            Sign Out
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}
