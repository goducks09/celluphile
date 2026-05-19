import { sendSystemNotification } from '../../app/lib/notifications/send';
import webpush from 'web-push';
import User from '../../app/models/user';
import NotificationLog from '../../app/models/notificationLog';
import { POST } from '../../app/api/notifications/daily/route';
import { subscribeUser, unsubscribeUser, updateNotificationPreferences, getNotificationPreferences } from '../../app/lib/actions';
import { auth } from '@/auth';

jest.mock('web-push');
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

jest.mock('next/server', () => ({
    NextResponse: {
        json: (body: any, init?: ResponseInit) => ({
            status: init?.status ?? 200,
            json: async () => body,
        }),
    },
}));

jest.mock('mongoose', () => {
    class MockObjectId {
        id: string;
        constructor(id: string) { this.id = id; }
        toString() { return this.id; }
        static isValid(id: string) { return /^[0-9a-fA-F]{24}$/.test(id); }
    }
    class MockSchema { index = jest.fn(); }
    (MockSchema as any).Types = { ObjectId: MockObjectId };
    return {
        __esModule: true,
        default: { connect: jest.fn() },
        Types: { ObjectId: MockObjectId },
        Schema: MockSchema,
        model: jest.fn(),
        models: {},
    };
});
jest.mock('../../app/lib/mongoose', () => jest.fn());

jest.mock('../../app/models/user', () => ({
    __esModule: true,
    default: {
        findById: jest.fn(),
        findByIdAndUpdate: jest.fn(),
        find: jest.fn().mockReturnValue({ lean: jest.fn() }),
    }
}));

jest.mock('../../app/models/notificationLog', () => {
    const mockModel: any = jest.fn(function (this: any, data: any) {
        this.data = data;
        this.save = jest.fn().mockResolvedValue(true);
    });
    mockModel.findOne = jest.fn();
    return { __esModule: true, default: mockModel };
});

jest.mock('@/auth', () => ({
    auth: jest.fn(),
}));

describe('Notifications system', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.CRON_SECRET = 'secret123';
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'pub';
        process.env.VAPID_PRIVATE_KEY = 'priv';
    });

    describe('sendSystemNotification', () => {
        it('returns skipped if payload is invalid', async () => {
            const result = await sendSystemNotification('user123', 'recommendations', { invalid: 'payload' } as any);
            expect(result.skippedReason).toBe('Invalid notification payload.');
            expect(result.sent).toBe(0);
        });

        it('returns error if user not found', async () => {
            User.findById = jest.fn().mockResolvedValue(null);
            const result = await sendSystemNotification('user123', 'recommendations', { title: 'Test', body: 'Test' });
            expect(result.skippedReason).toBe('User not found.');
            expect(result.sent).toBe(0);
        });

        it('returns error if user has no push subscriptions', async () => {
            const mockUser = {
                notificationPreferences: { recommendations: true },
                webPushSubscriptions: []
            };
            User.findById = jest.fn().mockResolvedValue(mockUser);
            const result = await sendSystemNotification('user123', 'recommendations', { title: 'Test', body: 'Test' });
            expect(result.skippedReason).toBe('User has no push subscriptions.');
            expect(result.sent).toBe(0);
        });

        it('returns 0 if user opts out', async () => {
            const mockUser = {
                notificationPreferences: { recommendations: false }
            };
            User.findById = jest.fn().mockResolvedValue(mockUser);

            const result = await sendSystemNotification('user123', 'recommendations', { title: 'Test', body: 'Test' });
            expect(result.skippedReason).toBe('User opted out of this notification type.');
            expect(result.sent).toBe(0);
            expect(webpush.sendNotification).not.toHaveBeenCalled();
        });

        it('skips if cooldown has not elapsed', async () => {
            const mockUser = {
                notificationPreferences: { recommendations: true }
            };
            User.findById = jest.fn().mockResolvedValue(mockUser);
            NotificationLog.findOne = jest.fn().mockResolvedValue({ _id: 'recent-log' });

            const result = await sendSystemNotification('user123', 'recommendations', { title: 'Test', body: 'Test' });
            expect(result.skippedReason).toBe('Cooldown period has not elapsed.');
        });

        it('sends to multiple devices and cleans up 410 dead endpoints', async () => {
            const mockUser = {
                notificationPreferences: { recommendations: true },
                webPushSubscriptions: [
                    { endpoint: 'http://good' },
                    { endpoint: 'http://bad' }
                ]
            };
            User.findById = jest.fn().mockResolvedValue(mockUser);
            NotificationLog.findOne = jest.fn().mockResolvedValue(null);
            User.findByIdAndUpdate = jest.fn().mockResolvedValue(true);

            (webpush.sendNotification as jest.Mock).mockImplementation((sub: any) => {
                if (sub.endpoint === 'http://bad') {
                    return Promise.reject({ statusCode: 410 });
                }
                return Promise.resolve();
            });

            const result = await sendSystemNotification('user123', 'recommendations', { title: 'Test', body: 'Test' });
            expect(result.sent).toBe(1);
            expect(result.failedDevices).toBe(1);
            expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user123', {
                $pull: { webPushSubscriptions: { endpoint: { $in: ['http://bad'] } } }
            });
        });
    });

    describe('Cron API Route', () => {
        it('rejects missing secret', async () => {
            const req = {
                headers: { get: () => null }
            } as any;
            const res = await POST(req);
            expect(res.status).toBe(401);
        });

        it('rejects wrong secret', async () => {
            const req = {
                headers: { get: () => 'Bearer wrong123' }
            } as any;
            const res = await POST(req);
            expect(res.status).toBe(401);
        });

        it('processes users on valid secret', async () => {
            const req = {
                headers: { get: () => 'Bearer secret123' }
            } as any;
            User.find = jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([])
            });
            const res = await POST(req);
            expect(res.status).toBe(200);
        });
    });

    describe('subscribeUser & unsubscribeUser', () => {
        it('pulls existing endpoint then adds via $addToSet for subscribeUser', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { id: '000000000000000000000000' } });
            User.findByIdAndUpdate = jest.fn().mockResolvedValue(true);

            const sub = { endpoint: 'https://push.example.com/sub/123', keys: { p256dh: 'a', auth: 'b' } };
            const result = await subscribeUser(sub as any);

            expect(result).toEqual({ success: true });

            expect(User.findByIdAndUpdate).toHaveBeenNthCalledWith(1,
                '000000000000000000000000',
                { $pull: { webPushSubscriptions: { endpoint: 'https://push.example.com/sub/123' } } }
            );
            expect(User.findByIdAndUpdate).toHaveBeenNthCalledWith(2,
                '000000000000000000000000',
                { $addToSet: { webPushSubscriptions: sub } }
            );
        });

        it('uses $pull by endpoint for unsubscribeUser', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { id: '000000000000000000000000' } });
            User.findByIdAndUpdate = jest.fn().mockResolvedValue(true);

            await unsubscribeUser('https://push.example.com/sub/123');

            expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
                '000000000000000000000000',
                { $pull: { webPushSubscriptions: { endpoint: 'https://push.example.com/sub/123' } } }
            );
        });
    });

    describe('Preferences API', () => {
        it('getNotificationPreferences returns stored preferences', async () => {
            const mockPrefs = { recommendations: true, security: false };
            (auth as jest.Mock).mockResolvedValue({ user: { id: '000000000000000000000000' } });
            User.findById = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ notificationPreferences: mockPrefs }) });

            const result = await getNotificationPreferences();
            expect(result.success).toBe(true);
            expect(result.preferences).toEqual(mockPrefs);
        });

        it('updateNotificationPreferences updates valid preferences', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { id: '000000000000000000000000' } });
            User.findByIdAndUpdate = jest.fn().mockResolvedValue(true);

            const result = await updateNotificationPreferences({ recommendations: true } as any);
            expect(result.success).toBe(true);
            expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
                '000000000000000000000000',
                { $set: { 'notificationPreferences.recommendations': true } }
            );
        });

        it('updateNotificationPreferences rejects invalid preferences', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { id: '000000000000000000000000' } });

            const result = await updateNotificationPreferences({ invalidKey: true } as any);
            expect(result.success).toBe(false);
            expect(result.message).toBe('No valid preferences provided.');
        });
    });
});
