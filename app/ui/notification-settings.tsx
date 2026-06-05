'use client';

import { useState, useTransition } from 'react';
import { NOTIFICATION_REGISTRY, NotificationType } from '../lib/notifications/registry';
import { updateNotificationPreferences } from '../lib/actions';
import PushNotificationManager from './push-notification-manager';

export default function NotificationSettings({ initialPreferences }: { initialPreferences?: Record<NotificationType, boolean> }) {
    const [preferences, setPreferences] = useState<Record<NotificationType, boolean>>(() => {
        if (initialPreferences) return initialPreferences;
        const defaults: any = {};
        for (const [key, val] of Object.entries(NOTIFICATION_REGISTRY)) {
            defaults[key as NotificationType] = val.defaultEnabled;
        }
        return defaults;
    });
    const [isPending, startTransition] = useTransition();

    const handleToggle = (type: NotificationType) => {
        const newValue = !preferences[type];
        const newPrefs = { ...preferences, [type]: newValue };
        
        startTransition(async () => {
            setPreferences(newPrefs);
            try {
                const res = await updateNotificationPreferences(newPrefs);
                if (!res.success) {
                    // Revert on error
                    setPreferences(preferences);
                }
            } catch (err) {
                console.error('Failed to update preference:', err);
                // Revert on error
                setPreferences(preferences);
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-md mb-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200">Global Push Status</h3>
                <PushNotificationManager />
            </div>

            <div className="space-y-4">
                {Object.values(NOTIFICATION_REGISTRY).map((def) => (
                    <div key={def.type} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                        <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">{def.label}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {def.cronScheduled ? 'Scheduled automatically' : 'Triggered by activity'}
                            </p>
                        </div>
                        <button
                            onClick={() => handleToggle(def.type)}
                            disabled={isPending}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${preferences[def.type] ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${preferences[def.type] ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
