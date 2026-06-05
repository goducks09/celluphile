import NotificationSettings from '@/app/ui/notification-settings';
import { getNotificationPreferences } from '@/app/lib/data';

export default async function SettingsPage() {
    const res = await getNotificationPreferences();
    const initialPreferences = res.success && res.preferences ? res.preferences : undefined;

    return (
        <main className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight mb-2">Settings</h1>
                <p className="text-gray-500 dark:text-gray-400">Manage your account preferences and notifications.</p>
            </div>
            
            <div className="grid gap-6 max-w-2xl">
                <section className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 bg-white dark:bg-gray-900 shadow-sm">
                    <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Notification Preferences</h2>
                    <NotificationSettings initialPreferences={initialPreferences} />
                </section>
            </div>
        </main>
    );
}
