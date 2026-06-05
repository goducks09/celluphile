import { NextRequest, NextResponse } from 'next/server';
import { getRandomMovie } from '@/app/lib/data';

export async function GET(request: NextRequest) {
    try {
        const result = await getRandomMovie();
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ success: false, message: 'Failed to fetch random movie' }, { status: 500 });
    }
}
