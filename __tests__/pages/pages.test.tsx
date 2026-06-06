import { redirect } from 'next/navigation';
import { render, screen } from '@testing-library/react';

// Mock navigation
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

jest.mock('@/app/lib/data', () => ({
  getRandomMovie: jest.fn(),
}));

jest.mock('@/app/ui/random-movie', () => ({
  __esModule: true,
  default: ({ initialMovie }: any) => <div data-testid="random-movie-client">{initialMovie?.title}</div>,
}));

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
    it('redirects to /dashboard', async () => {
      const Home = (await import('@/app/page')).default;
      render(<Home />);
      expect(redirect).toHaveBeenCalledWith('/dashboard');
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

    it('contains a button to try again', async () => {
      const OfflinePage = (await import('@/app/offline/page')).default;
      render(<OfflinePage />);
      const retryButton = screen.getByRole('button', { name: /try again/i });
      expect(retryButton).toBeInTheDocument();
    });
  });
  describe('Random page', () => {
    it('renders empty-state message with link to /library if library is empty', async () => {
      const { getRandomMovie } = require('@/app/lib/data');
      getRandomMovie.mockResolvedValue({ success: false, message: 'Your library is empty.' });
      
      const RandomPage = (await import('@/app/(app)/random/page')).default;
      render(await RandomPage());
      
      expect(screen.getByText('Your library is empty.')).toBeInTheDocument();
      expect(screen.getByText('It looks like there are no movies available to pick from.')).toBeInTheDocument();
      const link = screen.getByRole('link', { name: /go to library/i });
      expect(link).toHaveAttribute('href', '/library');
    });

    it('renders RandomMovieClient with returned movie prop', async () => {
      const { getRandomMovie } = require('@/app/lib/data');
      getRandomMovie.mockResolvedValue({ 
        success: true, 
        movie: { title: 'Test Random Movie', tmdbId: 123 } 
      });
      
      const RandomPage = (await import('@/app/(app)/random/page')).default;
      render(await RandomPage());
      
      expect(screen.getByTestId('random-movie-client')).toHaveTextContent('Test Random Movie');
    });
  });
});
