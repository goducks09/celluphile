'use client';

import dynamic from 'next/dynamic';

// These components rely on browser-only APIs. Skipping SSR prevents
// hydration tree mismatches and avoids navigator/window guards.
const InstallPrompt = dynamic(() => import('./ui/install-prompt'), { ssr: false });
const OfflineManager = dynamic(() => import('./ui/offline-manager'), { ssr: false });
const PushNotificationManager = dynamic(() => import('./ui/push-notification-manager'), { ssr: false });

export default function ClientLayout() {
    return (
        <>
            <PushNotificationManager />
            <InstallPrompt />
            <OfflineManager />
        </>
    );
}