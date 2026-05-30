import NextAuth from 'next-auth';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import client from '@/app/lib/db';
import Credentials from 'next-auth/providers/credentials';
import User from '@/app/models/user';
import dbConnect from '@/app/lib/mongoose';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(client),
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      name: 'Credentials',
      async authorize(credentials) {
        const emailSchema = z.string().email();
        const passwordSchema = z.string().min(1);

        const email = emailSchema.safeParse(credentials?.email);
        const password = passwordSchema.safeParse(credentials?.password);
        if (!email.success || !password.success) return null;

        await dbConnect();

        const user = await User.findOne({ email: email.data });

        if (!user || !user.password) {
          return null;
        }

        const isPasswordCorrect = await bcrypt.compare(
          password.data,
          user.password
        );

        if (isPasswordCorrect) {
          // Return user object without the password
          return { id: user._id.toString(), email: user.email, name: user.name };
        }

        return null;
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    // This callback is used to customize the JWT token
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    // This callback is used to customize the session object
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const protectedPaths = ['/dashboard', '/library', '/random', '/recommendations', '/settings', '/wishlist'];
      const isProtected = protectedPaths.some(p => nextUrl.pathname.startsWith(p));
      if (isProtected) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn) {
        // Redirect logged-in users from login/register pages to the dashboard
        if (nextUrl.pathname.startsWith('/login') || nextUrl.pathname.startsWith('/register')) {
          return Response.redirect(new URL('/dashboard', nextUrl));
        }
      }
      return true;
    },
  },
});
