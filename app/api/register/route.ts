import { NextRequest, NextResponse } from 'next/server';
import User from '@/app/models/user';
import dbConnect from '@/app/lib/mongoose';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { checkRateLimit } from '@vercel/firewall';

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(12).max(128),
});

export async function POST(req: NextRequest) {
  // Rate limit registration requests
  let rateLimited = false;
  if (process.env.TEST_MODE !== 'true' && process.env.NODE_ENV !== 'development') {
    const result = await checkRateLimit('update-object', { request: req });
    rateLimited = result.rateLimited;
  }
  if (rateLimited) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', message: 'Rate limit exceeded' },
      { status: 429 }
    );
  }

  await dbConnect();

  try {
    const body = await req.json();

    // Check for missing fields first to satisfy standard expected error message
    if (!body || !body.email || !body.password) {
      return NextResponse.json({ message: 'Email and password are required.' }, { status: 400 });
    }

    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const passwordIssue = parsed.error.issues.find(issue => issue.path.includes('password'));
      if (passwordIssue) {
        return NextResponse.json({ message: 'Password must be at least 12 characters long.' }, { status: 400 });
      }
      return NextResponse.json({ message: 'Email and password are required.' }, { status: 400 });
    }

    const { email, password } = parsed.data;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return NextResponse.json({ message: 'Please choose a different username.' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = new User({
      email,
      password: hashedPassword,
    });

    await newUser.save();

    return NextResponse.json({ message: 'User created successfully.' }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}
