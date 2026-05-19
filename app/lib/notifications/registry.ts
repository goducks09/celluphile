export type NotificationType =
    | 'recommendations'
    | 'trending'
    | 'milestone'
    | 'rewatch'
    | 'backgroundTask';

export interface NotificationTypeDef {
    /** Key used in notificationPreferences and NotificationLog */
    type: NotificationType;
    /** Human-readable label for the preferences UI */
    label: string;
    /** Default opt-in state */
    defaultEnabled: boolean;
    /** Minimum hours between sends of this type per user (0 = no cooldown) */
    cooldownHours: number;
    /** Whether this type is triggered by cron (vs. inline in a server action) */
    cronScheduled: boolean;
}

export const NOTIFICATION_REGISTRY: Record<NotificationType, NotificationTypeDef> = {
    recommendations: {
        type: 'recommendations',
        label: 'AI Movie Recommendations',
        defaultEnabled: true,
        cooldownHours: 24,
        cronScheduled: true,
    },
    trending: {
        type: 'trending',
        label: 'Trending & Popular Movies',
        defaultEnabled: true,
        cooldownHours: 48,
        cronScheduled: true,
    },
    milestone: {
        type: 'milestone',
        label: 'Library Milestones',
        defaultEnabled: true,
        cooldownHours: 0, // Dedup is log-based, not time-based
        cronScheduled: false,
    },
    rewatch: {
        type: 'rewatch',
        label: 'Forgotten Favorites',
        defaultEnabled: true,
        cooldownHours: 168, // 1 week
        cronScheduled: true,
    },
    backgroundTask: {
        type: 'backgroundTask',
        label: 'Background Task Completion',
        defaultEnabled: true,
        cooldownHours: 0,
        cronScheduled: false,
    },
};
