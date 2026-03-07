'use client';

import { useEffect, useState } from 'react';

export default function InstallPrompt() {
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(true);

    useEffect(() => {
        // Check if the user has dismissed the prompt
        if (localStorage.getItem('installPromptDismissed')) {
            setIsStandalone(true);
            return;
        }

        // Detect if device is iOS
        const isIosDevice = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(isIosDevice);

        // Detect if already installed/running in standalone PWA mode
        const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in window.navigator && (window.navigator as any).standalone === true);
        setIsStandalone(isInStandaloneMode);
    }, []);

    // Only show the prompt on iOS if they are not already installed
    if (!isIOS || isStandalone) {
        return null;
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-indigo-600 text-white flex justify-between items-center shadow-lg z-50">
            <p className="text-sm">
                To install this app, tap the share button <span className="font-bold text-xl">(↑)</span> and select <strong>"Add to Home Screen"</strong>
            </p>
            <button
                className="ml-4 px-3 py-1 bg-white text-indigo-600 rounded text-sm shrink-0 font-medium"
                onClick={() => {
                    localStorage.setItem('installPromptDismissed', 'true');
                    setIsStandalone(true);
                }}
            >
                Dismiss
            </button>
        </div>
    );
}
