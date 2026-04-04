import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from '@/app/dashboard/error';

describe('Dashboard Error Boundary', () => {
  const mockError = new Error('Test error') as Error & { digest?: string };
  const mockReset = jest.fn();

  beforeEach(() => {
    // Suppress console.error from the useEffect in the error component
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockReset.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the error heading', () => {
    render(<ErrorBoundary error={mockError} reset={mockReset} />);
    expect(screen.getByText('Something went wrong!')).toBeInTheDocument();
  });

  it('renders the recovery message', () => {
    render(<ErrorBoundary error={mockError} reset={mockReset} />);
    expect(
      screen.getByText(/unexpected error while trying to load your dashboard/i)
    ).toBeInTheDocument();
  });

  it('renders the Try again button', () => {
    render(<ErrorBoundary error={mockError} reset={mockReset} />);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('calls reset when Try again is clicked', async () => {
    const user = userEvent.setup();
    render(<ErrorBoundary error={mockError} reset={mockReset} />);

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it('logs the error to console', () => {
    render(<ErrorBoundary error={mockError} reset={mockReset} />);
    expect(console.error).toHaveBeenCalledWith(
      'Library Dashboard ErrorBoundary caught:',
      mockError
    );
  });

  it('renders the warning icon', () => {
    render(<ErrorBoundary error={mockError} reset={mockReset} />);
    // The ExclamationTriangleIcon renders as an SVG
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
