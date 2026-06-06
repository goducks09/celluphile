import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterForm from '@/app/ui/register-form';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
}));

// Mock sonner
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe('RegisterForm', () => {
  let mockPush: jest.Mock;
  let mockRefresh: jest.Mock;

  beforeEach(() => {
    global.fetch = jest.fn();
    jest.clearAllMocks();
    mockPush = jest.fn();
    mockRefresh = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      refresh: mockRefresh,
    });
  });

  it('renders email + password inputs and register button', () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
  });

  it('client-side validation: empty fields show error without network call', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    // Submit by clicking the register button — inputs start empty, so client-side
    // validation should fire. We need to bypass HTML5 validation, so submit the form directly.
    const form = screen.getByRole('button', { name: /register/i }).closest('form')!;
    // Use fireEvent.submit to bypass HTML5 required validation
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Email and password are required.')).toBeInTheDocument();
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('successful registration signs in and redirects to /dashboard', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: 'User created successfully.' }),
    });
    (signIn as jest.Mock).mockResolvedValue({ error: null });

    render(<RegisterForm />);
    await user.type(screen.getByLabelText(/email/i), 'new@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith('credentials', {
        redirect: false,
        email: 'new@example.com',
        password: 'password123',
      });
      expect(toast.success).toHaveBeenCalledWith('Account created!');
      expect(mockRefresh).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('successful registration but failed auto-login redirects to /login', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: 'User created successfully.' }),
    });
    (signIn as jest.Mock).mockResolvedValue({ error: 'CredentialsSignin' });

    render(<RegisterForm />);
    await user.type(screen.getByLabelText(/email/i), 'new@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Account created! Please log in.');
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('server returns 409 (duplicate) — shows server error message', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Please choose a different username.' }),
    });

    render(<RegisterForm />);
    await user.type(screen.getByLabelText(/email/i), 'existing@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Please choose a different username.')
      ).toBeInTheDocument();
    });
  });

  it('network failure shows generic error', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<RegisterForm />);
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(screen.getByText(/an error occurred/i)).toBeInTheDocument();
    });
  });
});
