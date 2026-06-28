import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Celluphile',
        short_name: 'Celluphile',
        description: 'A Progressive Web App for managing your movie library, built with Next.js.',
        start_url: '/launch',
        display: 'standalone',
        background_color: '#1a1a2e',
        theme_color: '#4f46e5', // Indigo-600 to match the app theme
        icons: [
            {
                src: '/icon-192x192.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/icon-512x512.png',
                sizes: '512x512',
                type: 'image/png',
            },
        ],
    }
}
