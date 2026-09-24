import { Suspense } from 'react';
import NotificationSettings from '@/app/ui/notification-settings';
import { getNotificationPreferences } from '@/app/lib/data';

async function NotificationSettingsContent() {
    const res = await getNotificationPreferences();
    const initialPreferences = res.success && res.preferences ? res.preferences : undefined;
    return <NotificationSettings initialPreferences={initialPreferences} />;
}

export default function SettingsPage() {
    return (
        <main className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight mb-2">Settings</h1>
                <p className="text-gray-500 dark:text-gray-400">Manage your account preferences and notifications.</p>
            </div>

            <div className="grid gap-6 max-w-2xl">
                <section className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 bg-white dark:bg-gray-900 shadow-sm">
                    <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Notification Preferences</h2>
                    <Suspense fallback={
                        <div className="animate-pulse space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="h-4 w-48 rounded" style={{ background: 'var(--background-input)' }} />
                                    <div className="h-6 w-12 rounded-full" style={{ background: 'var(--background-input)' }} />
                                </div>
                            ))}
                        </div>
                    }>
                        <NotificationSettingsContent />
                    </Suspense>
                </section>
            </div>
        </main>
    );
}
