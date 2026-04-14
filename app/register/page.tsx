import RegisterForm from '@/app/ui/register-form';
import Link from 'next/link';

export default function RegisterPage() {
  return (
    <main className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-8 space-y-8 rounded-lg shadow-md" style={{ background: 'var(--background-card)' }}>
        <h2 className="text-2xl font-bold text-center" style={{ color: 'var(--foreground)' }}>Create a New Account</h2>
        <RegisterForm />
         <p className="text-center" style={{ color: 'var(--foreground-muted)' }}>
          {'Already have an account?'}{' '}
          <Link href="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
