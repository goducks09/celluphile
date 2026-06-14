'use client';

import { useState, useRef, useEffect } from 'react';
import { type SerializedMovie } from '@/app/lib/data';
import { PlusCircleIcon } from '@heroicons/react/24/solid';
import AddToLibraryMenu from './add-to-library-menu';

export default function AddRecommendationButton({ movie }: { movie: SerializedMovie }) {
    const [isOpen, setIsOpen] = useState(false);
    const popupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="absolute top-2 right-2 z-20" ref={popupRef}>
            <button
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className="text-indigo-500 hover:text-indigo-300 focus:outline-none disabled:opacity-50 transition-colors drop-shadow-md bg-white rounded-full"
                aria-label="Add movie"
            >
                <PlusCircleIcon className="w-8 h-8 sm:w-10 sm:h-10" />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-10 mt-1 w-48 z-50" onClick={(e) => e.stopPropagation()}>
                    <AddToLibraryMenu movie={movie} onClose={() => setIsOpen(false)} />
                </div>
            )}
        </div>
    );
}
