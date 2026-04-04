import { render, screen } from '@testing-library/react';

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

// Mock next/link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

// Mock LoginForm and RegisterForm since they are tested separately
jest.mock('@/app/ui/login-form', () => ({
  __esModule: true,
  default: () => <div data-testid="login-form">LoginForm</div>,
}));

jest.mock('@/app/ui/register-form', () => ({
  __esModule: true,
  default: () => <div data-testid="register-form">RegisterForm</div>,
}));

describe('Page Components', () => {
  describe('Home page', () => {
    it('renders the heading', async () => {
      const Home = (await import('@/app/page')).default;
      render(<Home />);
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('snapshot test', async () => {
      const Home = (await import('@/app/page')).default;
      const { container } = render(<Home />);
      expect(container).toMatchSnapshot();
    });
  });

  describe('Login page', () => {
    it('renders heading "Login to Your Account"', async () => {
      const LoginPage = (await import('@/app/login/page')).default;
      render(<LoginPage />);
      expect(screen.getByText('Login to Your Account')).toBeInTheDocument();
    });

    it('contains link to /register', async () => {
      const LoginPage = (await import('@/app/login/page')).default;
      render(<LoginPage />);
      const signUpLink = screen.getByRole('link', { name: /sign up/i });
      expect(signUpLink).toHaveAttribute('href', '/register');
    });
  });

  describe('Register page', () => {
    it('renders heading "Create a New Account"', async () => {
      const RegisterPage = (await import('@/app/register/page')).default;
      render(<RegisterPage />);
      expect(screen.getByText('Create a New Account')).toBeInTheDocument();
    });

    it('contains link to /login', async () => {
      const RegisterPage = (await import('@/app/register/page')).default;
      render(<RegisterPage />);
      const signInLink = screen.getByRole('link', { name: /sign in/i });
      expect(signInLink).toHaveAttribute('href', '/login');
    });
  });

  describe('Offline page', () => {
    it('renders "You are currently offline"', async () => {
      const OfflinePage = (await import('@/app/offline/page')).default;
      render(<OfflinePage />);
      expect(screen.getByText('You are currently offline')).toBeInTheDocument();
    });

    it('contains link to /dashboard', async () => {
      const OfflinePage = (await import('@/app/offline/page')).default;
      render(<OfflinePage />);
      const dashboardLink = screen.getByRole('link', { name: /return to library/i });
      expect(dashboardLink).toHaveAttribute('href', '/dashboard');
    });
  });
});
