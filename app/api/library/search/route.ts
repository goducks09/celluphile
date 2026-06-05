import { NextRequest, NextResponse } from 'next/server';
import { searchUserLibrary } from '@/app/lib/data';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { query, filters, sortOpts, pagination } = body;

        const result = await searchUserLibrary(query, filters, sortOpts, pagination);
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ success: false, message: 'Failed to search library' }, { status: 500 });
    }
}
