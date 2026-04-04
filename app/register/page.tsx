import RegisterForm from '@/app/ui/register-form';
import Link from 'next/link';

export default function RegisterPage() {
  return (
    <main className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900">Create a New Account</h2>
        <RegisterForm />
         <p className="text-center text-gray-600">
          {'Already have an account?'}{' '}
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
