import { handlers } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@vercel/firewall';

const { GET: authGET, POST: authPOST } = handlers;

export { authGET as GET };

export async function POST(req: NextRequest) {
  const url = new URL(req.url);

  if (
    url.pathname.endsWith('/api/auth/callback/credentials') ||
    url.pathname.endsWith('/api/auth/signin/credentials')
  ) {
    const { rateLimited } = await checkRateLimit('update-object', { request: req });
    if (rateLimited) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', message: 'Rate limit exceeded' },
        { status: 429 }
      );
    }
  }

  return authPOST(req);
}
