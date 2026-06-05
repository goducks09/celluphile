import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import dbConnect from '../../../lib/mongoose';
import User from '../../../models/user';
import { sendSystemNotification } from '../../../lib/notifications/send';

function validateCronSecret(request: Request): boolean {
    const authHeader = request.headers.get('Authorization');
    const providedSecret = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const secret = process.env.CRON_SECRET;
    
    if (!providedSecret || !secret) return false;
    
    try {
        return timingSafeEqual(Buffer.from(providedSecret), Buffer.from(secret));
    } catch {
        return false;
    }
}

async function sendRecommendationNotification(userId: string) {
    // Phase 1: simple demo using arbitrary movie data to fulfill requirements
    return sendSystemNotification(
        userId,
        'recommendations',
        {
            title: 'New Movie Recommendation',
            body: "We've found a new recommendation for you: Inception! Check it out in your recommendations.",
            url: '/recommendations'
        },
        { tmdbId: 27205 }
    );
}

export async function POST(request: Request) {
    if (!validateCronSecret(request)) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    try {
        await dbConnect();

        // Fetch users who have at least one webPushSubscription
        const users = await User.find({ webPushSubscriptions: { $not: { $size: 0 } } }, '_id').lean();

        const chunkSize = 20;
        const results = [];
        for (let i = 0; i < users.length; i += chunkSize) {
            const chunk = users.slice(i, i + chunkSize);
            const chunkResults = await Promise.allSettled(
                chunk.map(u => sendRecommendationNotification(u._id.toString()))
            );
            results.push(...chunkResults);
        }

        return NextResponse.json({ success: true, processed: users.length });
    } catch (err: any) {
        console.error('Cron job error:', err);
        return NextResponse.json({ success: false, message: 'Internal server error.' }, { status: 500 });
    }
}
