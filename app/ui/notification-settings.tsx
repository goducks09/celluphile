'use client';

import { useState, useEffect } from 'react';
import { NOTIFICATION_REGISTRY, NotificationType } from '../lib/notifications/registry';
import { updateNotificationPreferences, getNotificationPreferences } from '../lib/actions';
import PushNotificationManager from './push-notification-manager';

export default function NotificationSettings() {
    const [preferences, setPreferences] = useState<Record<NotificationType, boolean> | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        async function fetchPrefs() {
            const res = await getNotificationPreferences();
            if (res.success && res.preferences) {
                setPreferences(res.preferences);
            } else {
                // Initialize from registry default
                const defaults: any = {};
                for (const [key, val] of Object.entries(NOTIFICATION_REGISTRY)) {
                    defaults[key as NotificationType] = val.defaultEnabled;
                }
                setPreferences(defaults);
            }
            setLoading(false);
        }
        fetchPrefs();
    }, []);

    const handleToggle = async (type: NotificationType) => {
        if (!preferences) return;
        const newValue = !preferences[type];
        const newPrefs = { ...preferences, [type]: newValue };
        setPreferences(newPrefs);
        setSaving(true);
        try {
            await updateNotificationPreferences(newPrefs);
        } catch (err) {
            console.error('Failed to update preference:', err);
            // Revert on error
            setPreferences(preferences);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="text-sm text-gray-500 animate-pulse">Loading preferences...</div>;
    }

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
                            disabled={saving}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${preferences?.[def.type] ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${preferences?.[def.type] ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
