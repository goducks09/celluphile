import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorComponent from '@/app/(app)/error';

// Mock @heroicons/react
jest.mock('@heroicons/react/24/outline', () => ({
  ExclamationTriangleIcon: (props: any) => <svg data-testid="warning-icon" {...props} />,
}));

describe('Dashboard Error', () => {
  const mockReset = jest.fn();
  const testError = new Error('Test error message');

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('renders error message and "Try again" button', () => {
    render(<ErrorComponent error={testError} reset={mockReset} />);

    expect(screen.getByText('Something went wrong!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('"Try again" button calls reset() prop', async () => {
    const user = userEvent.setup();
    render(<ErrorComponent error={testError} reset={mockReset} />);

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it('logs error via console.error on mount', () => {
    render(<ErrorComponent error={testError} reset={mockReset} />);

    expect(console.error).toHaveBeenCalledWith(
      'Library Dashboard ErrorBoundary caught:',
      testError
    );
  });
});
