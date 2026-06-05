import LoginForm from '@/app/ui/login-form';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <main className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-8 space-y-8 rounded-lg shadow-md" style={{ background: 'var(--background-card)' }}>
        <h2 className="text-2xl font-bold text-center" style={{ color: 'var(--foreground)' }}>Login to Your Account</h2>
        <LoginForm />
        <p className="text-center" style={{ color: 'var(--foreground-muted)' }}>
          {"Don't have an account?"}{" "}
          <Link href="/register" className="font-medium text-indigo-400 hover:text-indigo-300">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
