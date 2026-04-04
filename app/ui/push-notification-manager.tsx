'use client';

import { useState, useEffect } from 'react';

import { subscribeUser, unsubscribeUser, sendNotification } from '../lib/actions';
import urlBase64ToUint8Array from '../lib/helpers';


export default function PushNotificationManager() {
    const [isSupported, setIsSupported] = useState(false)
    const [subscription, setSubscription] = useState<PushSubscription | null>(
        null
    )
    const [message, setMessage] = useState('')

    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true)
            registerServiceWorker()
        }
    }, [])

    async function registerServiceWorker() {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/',
                updateViaCache: 'none',
            })
            const sub = await registration.pushManager.getSubscription()
            setSubscription(sub)
        } catch (error) {
            // create a notification to let the user know that push notifications are not supported
            alert('Push notifications registration failed.')
            console.error('Error registering service worker:', error)
        }
    }

    async function subscribeToPush() {
        try {
            const registration = await navigator.serviceWorker.ready
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(
                    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
                ),
            })
            setSubscription(sub)
            const serializedSub = JSON.parse(JSON.stringify(sub))
            await subscribeUser(serializedSub)
        } catch (error) {
            // create a notification to let the user know that push notifications are not supported
            alert('Push notifications subscription failed.')
            console.error('Error subscribing to push notifications:', error)
        }
    }

    async function unsubscribeFromPush() {
        try {
            await subscription?.unsubscribe()
            setSubscription(null)
            await unsubscribeUser()
        } catch (error) {
            // create a notification to let the user know that push notifications are not supported
            alert('Push notifications unsubscription failed.')
            console.error('Error unsubscribing from push notifications:', error)
        }
    }

    async function sendTestNotification() {
        if (subscription) {
            await sendNotification(message)
            setMessage('')
        }
    }

    if (!isSupported) {
        return null
    }

    return (
        <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-6 bg-indigo-50 text-indigo-900 py-3 px-4 text-sm font-medium border-b border-indigo-100">
            {subscription ? (
                <>
                    <p className="text-center md:text-left">You are subscribed to push notifications.</p>
                    <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0 justify-center">
                        <button onClick={unsubscribeFromPush} className="text-indigo-600 hover:text-indigo-800 underline underline-offset-2 transition-colors whitespace-nowrap">
                            Unsubscribe
                        </button>
                        <input
                            type="text"
                            placeholder="Enter test message"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="border border-indigo-200 rounded px-3 py-1.5 text-black bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full max-w-[200px]"
                        />
                        <button onClick={sendTestNotification} className="bg-indigo-600 text-white rounded px-4 py-1.5 hover:bg-indigo-700 transition-colors whitespace-nowrap shadow-sm">
                            Send
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <p className="text-center md:text-left">You are not subscribed to push notifications.</p>
                    <button onClick={subscribeToPush} className="bg-indigo-600 text-white rounded px-5 py-1.5 hover:bg-indigo-700 transition-colors whitespace-nowrap shadow-sm mt-2 md:mt-0">
                        Subscribe
                    </button>
                </>
            )}
        </div>
    )
}