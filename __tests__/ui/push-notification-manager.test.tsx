import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PushNotificationManager from '@/app/ui/push-notification-manager';

// Mock server actions
const mockSubscribeUser = jest.fn();
const mockUnsubscribeUser = jest.fn();
jest.mock('@/app/lib/actions', () => ({
  subscribeUser: (...args: any[]) => mockSubscribeUser(...args),
  unsubscribeUser: (...args: any[]) => mockUnsubscribeUser(...args),
}));

// Mock helpers
jest.mock('@/app/lib/helpers', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
}));

// Helper to set up serviceWorker + PushManager for most tests
function setupServiceWorkerMock(existingSubscription: any = null) {
  let currentSubscription = existingSubscription;

  const mockNewSubscription = {
    unsubscribe: jest.fn().mockResolvedValue(true),
    endpoint: 'https://push.example.com/new',
    toJSON: () => ({
      endpoint: 'https://push.example.com/new',
      keys: { p256dh: 'new-key', auth: 'new-auth' },
    }),
  };

  const mockGetSubscription = jest.fn().mockImplementation(() => Promise.resolve(currentSubscription));
  const mockSubscribe = jest.fn().mockImplementation(() => {
    currentSubscription = mockNewSubscription;
    return Promise.resolve(mockNewSubscription);
  });
  const mockRegister = jest.fn().mockResolvedValue({
    pushManager: {
      getSubscription: mockGetSubscription,
      subscribe: mockSubscribe,
    },
  });

  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      register: mockRegister,
      ready: Promise.resolve({
        pushManager: {
          getSubscription: mockGetSubscription,
          subscribe: mockSubscribe,
        },
      }),
    },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, 'PushManager', {
    value: jest.fn(),
    writable: true,
    configurable: true,
  });

  const clearSubscription = () => { currentSubscription = null; };

  return { mockGetSubscription, mockSubscribe, mockRegister, clearSubscription };
}

describe('PushNotificationManager', () => {
  it('shows "not supported" message when serviceWorker is not in navigator', () => {
    // Remove serviceWorker from navigator
    const originalSW = navigator.serviceWorker;
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    render(<PushNotificationManager />);
    expect(
      screen.getByText(/push notifications are not supported/i)
    ).toBeInTheDocument();

    // Restore
    Object.defineProperty(navigator, 'serviceWorker', {
      value: originalSW,
      writable: true,
      configurable: true,
    });
  });

  it('shows "not subscribed" state when no subscription exists', async () => {
    setupServiceWorkerMock(null);

    await act(async () => {
      render(<PushNotificationManager />);
    });

    expect(
      screen.getByText(/not subscribed to push notifications/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /subscribe/i })).toBeInTheDocument();
  });

  it('shows unsubscribe button when subscribed', async () => {
    const mockSubscription = {
      unsubscribe: jest.fn().mockResolvedValue(true),
      endpoint: 'https://push.example.com',
      toJSON: () => ({
        endpoint: 'https://push.example.com',
        keys: { p256dh: 'key', auth: 'auth' },
      }),
    };

    setupServiceWorkerMock(mockSubscription);

    await act(async () => {
      render(<PushNotificationManager />);
    });

    expect(
      screen.getByRole('button', { name: /unsubscribe/i })
    ).toBeInTheDocument();
    // Should NOT show the "not subscribed" message or subscribe button
    expect(
      screen.queryByText(/not subscribed/i)
    ).not.toBeInTheDocument();
  });

  it('clicking "Subscribe" calls pushManager.subscribe and subscribeUser action', async () => {
    const user = userEvent.setup();
    setupServiceWorkerMock(null);
    mockSubscribeUser.mockResolvedValue(undefined);

    await act(async () => {
      render(<PushNotificationManager />);
    });

    await user.click(screen.getByRole('button', { name: /subscribe/i }));

    // After subscribing, the UI should switch to show the unsubscribe button
    await screen.findByRole('button', { name: /unsubscribe/i });

    // subscribeUser server action should have been called with serialized subscription
    expect(mockSubscribeUser).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'https://push.example.com/new',
        keys: expect.objectContaining({ p256dh: 'new-key', auth: 'new-auth' }),
      })
    );
  });

  it('clicking "Unsubscribe" calls subscription.unsubscribe and unsubscribeUser action', async () => {
    const user = userEvent.setup();
    const mockSubscription = {
      unsubscribe: jest.fn(),
      endpoint: 'https://push.example.com',
      toJSON: () => ({
        endpoint: 'https://push.example.com',
        keys: { p256dh: 'key', auth: 'auth' },
      }),
    };

    const { clearSubscription } = setupServiceWorkerMock(mockSubscription);
    // Wire the mock's unsubscribe to also clear the tracked subscription
    // so getSubscription returns null when re-read after the event.
    mockSubscription.unsubscribe.mockImplementation(() => {
      clearSubscription();
      return Promise.resolve(true);
    });
    mockUnsubscribeUser.mockResolvedValue(undefined);

    await act(async () => {
      render(<PushNotificationManager />);
    });

    await user.click(screen.getByRole('button', { name: /unsubscribe/i }));

    // subscription.unsubscribe() should have been called
    expect(mockSubscription.unsubscribe).toHaveBeenCalled();
    // unsubscribeUser server action should have been called
    expect(mockUnsubscribeUser).toHaveBeenCalledWith('https://push.example.com');

    // UI should switch back to "not subscribed"
    await screen.findByText(/not subscribed to push notifications/i);
  });
});
