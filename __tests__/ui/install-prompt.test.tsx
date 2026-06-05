import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InstallPrompt from '@/app/ui/install-prompt';

// Helper to set up navigator.userAgent
function mockUserAgent(value: string) {
  Object.defineProperty(navigator, 'userAgent', {
    value,
    writable: true,
    configurable: true,
  });
}

// Helper to set up window.matchMedia
function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    value: jest.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
    writable: true,
    configurable: true,
  });
}

describe('InstallPrompt', () => {
  const originalNavigator = navigator.userAgent;
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn((key: string) => mockStorage[key] ?? null),
        setItem: jest.fn((key: string, value: string) => {
          mockStorage[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete mockStorage[key];
        }),
      },
      writable: true,
      configurable: true,
    });

    // Reset standalone property
    Object.defineProperty(window.navigator, 'standalone', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  it('returns null on non-iOS device', () => {
    mockUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0');
    mockMatchMedia(false);

    const { container } = render(<InstallPrompt />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null if already in standalone mode', () => {
    mockUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    mockMatchMedia(true); // standalone mode

    const { container } = render(<InstallPrompt />);
    expect(container.innerHTML).toBe('');
  });

  it('shows install prompt on iOS (non-standalone)', async () => {
    mockUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    mockMatchMedia(false); // NOT in standalone

    await act(async () => {
      render(<InstallPrompt />);
    });

    expect(screen.getByText(/add to home screen/i)).toBeInTheDocument();
  });

  it('dismiss sets localStorage flag and hides prompt', async () => {
    const user = userEvent.setup();
    mockUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    mockMatchMedia(false);

    await act(async () => {
      render(<InstallPrompt />);
    });

    expect(screen.getByText(/add to home screen/i)).toBeInTheDocument();

    const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
    await user.click(dismissBtn);

    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      'installPromptDismissed',
      'true'
    );

    // After dismiss, the content should be gone
    expect(screen.queryByText(/add to home screen/i)).not.toBeInTheDocument();
  });

  it('returns null if previously dismissed (localStorage set)', () => {
    mockStorage['installPromptDismissed'] = 'true';
    mockUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    mockMatchMedia(false);

    const { container } = render(<InstallPrompt />);
    // The useEffect detects the localStorage flag and keeps isStandalone=true
    expect(container.innerHTML).toBe('');
  });
});
