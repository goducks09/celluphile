import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PushNotificationManager from '@/app/ui/push-notification-manager';

// Mock server actions
const mockSubscribeUser = jest.fn();
const mockUnsubscribeUser = jest.fn();
const mockSendNotification = jest.fn();
jest.mock('@/app/lib/actions', () => ({
  subscribeUser: (...args: any[]) => mockSubscribeUser(...args),
  unsubscribeUser: (...args: any[]) => mockUnsubscribeUser(...args),
  sendNotification: (...args: any[]) => mockSendNotification(...args),
}));

// Mock helpers
jest.mock('@/app/lib/helpers', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
}));

// Helper to set up serviceWorker + PushManager for most tests
function setupServiceWorkerMock(existingSubscription: any = null) {
  const mockGetSubscription = jest.fn().mockResolvedValue(existingSubscription);
  const mockSubscribe = jest.fn().mockResolvedValue({
    unsubscribe: jest.fn().mockResolvedValue(true),
    endpoint: 'https://push.example.com/new',
    toJSON: () => ({
      endpoint: 'https://push.example.com/new',
      keys: { p256dh: 'new-key', auth: 'new-auth' },
    }),
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

  return { mockGetSubscription, mockSubscribe, mockRegister };
}

describe('PushNotificationManager', () => {
  it('returns null when serviceWorker is not in navigator', () => {
    // Remove serviceWorker from navigator
    const originalSW = navigator.serviceWorker;
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { container } = render(<PushNotificationManager />);
    expect(container.innerHTML).toBe('');

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

  it('shows "subscribed" state with unsubscribe + test inputs', async () => {
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
      screen.getByText(/you are subscribed to push notifications/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /unsubscribe/i })
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/enter notification message/i)
    ).toBeInTheDocument();
  });

  it('clicking "Subscribe" calls pushManager.subscribe and subscribeUser action', async () => {
    const user = userEvent.setup();
    setupServiceWorkerMock(null);
    mockSubscribeUser.mockResolvedValue(undefined);

    await act(async () => {
      render(<PushNotificationManager />);
    });

    await user.click(screen.getByRole('button', { name: /subscribe/i }));

    // After subscribing, the UI should switch to "subscribed" state
    await screen.findByText(/you are subscribed to push notifications/i);

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
    const mockUnsubscribeFn = jest.fn().mockResolvedValue(true);
    const mockSubscription = {
      unsubscribe: mockUnsubscribeFn,
      endpoint: 'https://push.example.com',
      toJSON: () => ({
        endpoint: 'https://push.example.com',
        keys: { p256dh: 'key', auth: 'auth' },
      }),
    };

    setupServiceWorkerMock(mockSubscription);
    mockUnsubscribeUser.mockResolvedValue(undefined);

    await act(async () => {
      render(<PushNotificationManager />);
    });

    await user.click(screen.getByRole('button', { name: /unsubscribe/i }));

    // subscription.unsubscribe() should have been called
    expect(mockUnsubscribeFn).toHaveBeenCalled();
    // unsubscribeUser server action should have been called
    expect(mockUnsubscribeUser).toHaveBeenCalled();

    // UI should switch back to "not subscribed"
    await screen.findByText(/not subscribed to push notifications/i);
  });

  it('clicking "Send Test" calls sendNotification with the message and clears input', async () => {
    const user = userEvent.setup();
    const mockSubscription = {
      unsubscribe: jest.fn().mockResolvedValue(true),
      endpoint: 'https://push.example.com',
      toJSON: () => ({
        endpoint: 'https://push.example.com',
        keys: { p256dh: 'key', auth: 'auth' },
      }),
    };

    setupServiceWorkerMock(mockSubscription);
    mockSendNotification.mockResolvedValue(undefined);

    await act(async () => {
      render(<PushNotificationManager />);
    });

    const messageInput = screen.getByPlaceholderText(/enter notification message/i);
    await user.type(messageInput, 'Hello push!');
    await user.click(screen.getByRole('button', { name: /send test/i }));

    // sendNotification should have been called with the message text
    expect(mockSendNotification).toHaveBeenCalledWith('Hello push!');

    // Input should be cleared after sending
    expect(messageInput).toHaveValue('');
  });
});
