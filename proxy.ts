import { auth } from '@/auth';

export const proxy = auth;

export const config = {
  // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|sw\\.js|offline(?:/|$)|manifest\\.webmanifest|icon-.*\\.png).*)'],
};
