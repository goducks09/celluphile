import { NextRequest, NextResponse } from 'next/server';
import { getMovieDetails } from '@/app/lib/tmdb';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    if (!id || isNaN(Number(id))) {
        return NextResponse.json({ error: 'Invalid movie ID' }, { status: 400 });
    }

    try {
        const details = await getMovieDetails(Number(id));
        return NextResponse.json(details);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch details' }, { status: 500 });
    }
}
