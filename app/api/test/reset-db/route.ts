import { NextResponse } from 'next/server';
import dbConnect from '@/app/lib/mongoose';
import mongoose from 'mongoose';

export async function POST(request: Request) {
    if (process.env.TEST_MODE !== 'true') {
        return NextResponse.json({ error: 'This route is only available in the test environment.' }, { status: 403 });
    }

    // Defense-in-depth: require a shared secret to prevent accidental wipes
    const secret = request.headers.get('x-test-secret');
    if (secret !== process.env.TEST_RESET_SECRET) {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    try {
        await dbConnect();
        // Drop the whole test database to ensure a clean slate
        await mongoose.connection.dropDatabase();
        return NextResponse.json({ success: true, message: 'Test database reset successfully.' });
    } catch (error) {
        console.error('Failed to reset test database:', error);
        return NextResponse.json({ error: 'Failed to reset test database.' }, { status: 500 });
    }
}
