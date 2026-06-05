import 'server-only';
import webpush from 'web-push';
import dbConnect from '../mongoose';
import User from '../../models/user';
import NotificationLog from '../../models/notificationLog';
import { NotificationType, NOTIFICATION_REGISTRY } from './registry';
import { z } from 'zod';
import { pushSubscriptionSchema, notificationPayloadSchema, notificationMetadataSchema } from '../schemas';

type WebPushSubscription = z.infer<typeof pushSubscriptionSchema>;

let webPushInitialized = false;

function initWebPush() {
    if (webPushInitialized) return;
    try {
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        const privateKey = process.env.VAPID_PRIVATE_KEY;
        const vapidSubject = process.env.VAPID_SUBJECT;
        if (!publicKey || !privateKey || !vapidSubject) {
            console.warn('[@/lib/notifications/send] VAPID configuration is incomplete. Push notifications will be disabled.');
            return;
        }
        webpush.setVapidDetails(vapidSubject, publicKey, privateKey);
        webPushInitialized = true;
    } catch (err) {
        console.error('[@/lib/notifications/send] Failed to initialize web push:', err);
    }
}

initWebPush();

export async function sendSystemNotification(
    userId: string,
    type: NotificationType,
    payload: { title: string; body: string; url?: string; icon?: string },
    metadata: Record<string, unknown> = {}
): Promise<{ sent: number; skippedReason?: string; failedDevices?: number }> {
    if (!webPushInitialized) {
        return { sent: 0, skippedReason: 'Push notifications are not configured.' };
    }

    const parsedPayload = notificationPayloadSchema.safeParse(payload);
    if (!parsedPayload.success) {
        return { sent: 0, skippedReason: 'Invalid notification payload.' };
    }

    const parsedMetadata = notificationMetadataSchema.safeParse(metadata);
    if (!parsedMetadata.success) {
        return { sent: 0, skippedReason: 'Invalid notification metadata.' };
    }

    await dbConnect();
    const user = await User.findById(userId);

    if (!user) {
        return { sent: 0, skippedReason: 'User not found.' };
    }

    // Check preferences
    const isEnabled = user.notificationPreferences?.[type] ?? NOTIFICATION_REGISTRY[type].defaultEnabled;
    if (!isEnabled) {
        return { sent: 0, skippedReason: 'User opted out of this notification type.' };
    }

    const { cooldownHours } = NOTIFICATION_REGISTRY[type];

    // Enforce cooldown
    if (cooldownHours > 0) {
        const cooldownMs = cooldownHours * 60 * 60 * 1000;
        const cutoffTime = new Date(Date.now() - cooldownMs);

        const recentLog = await NotificationLog.findOne({
            userId,
            type,
            sentAt: { $gt: cutoffTime },
        });

        if (recentLog) {
            return { sent: 0, skippedReason: 'Cooldown period has not elapsed.' };
        }
    }

    const subscriptions = user.webPushSubscriptions || [];
    if (subscriptions.length === 0) {
        return { sent: 0, skippedReason: 'User has no push subscriptions.' };
    }

    let sent = 0;
    let failedDevices = 0;
    const deadEndpoints: string[] = [];

    const results = await Promise.allSettled(
        subscriptions.map((sub: WebPushSubscription) =>
            webpush.sendNotification(
                sub,
                JSON.stringify({
                    title: payload.title,
                    body: payload.body,
                    icon: payload.icon || '/icon-192x192.png',
                    url: payload.url || '/dashboard' // Flat URL structure
                })
            ).catch(err => {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    deadEndpoints.push(sub.endpoint);
                }
                throw err;
            })
        )
    );

    for (const result of results) {
        if (result.status === 'fulfilled') {
            sent++;
        } else {
            failedDevices++;
        }
    }

    if (deadEndpoints.length > 0) {
        await User.findByIdAndUpdate(userId, {
            $pull: { webPushSubscriptions: { endpoint: { $in: deadEndpoints } } }
        });
    }

    if (sent > 0 && type !== 'milestone') {
        const logEntry = new NotificationLog({
            userId,
            type,
            tmdbId: parsedMetadata.data.tmdbId,
            metadata: parsedMetadata.data
        });
        await logEntry.save().catch((e: any) => console.error('Failed to save notification log:', e));
    }

    return { sent, failedDevices };
}
