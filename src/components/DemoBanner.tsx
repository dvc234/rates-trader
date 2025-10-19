/**
 * DemoBanner Component
 * 
 * Displays a dismissible banner promoting the demo strategy.
 * Shows on first visit and can be dismissed by user.
 * 
 * @component
 */

'use client';

import { useState, useEffect } from 'react';

const BANNER_DISMISSED_KEY = 'demo_banner_dismissed';

export default function DemoBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if banner was previously dismissed
    const dismissed = localStorage.getItem(BANNER_DISMISSED_KEY);
    if (!dismissed) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">
              🧪 <span className="font-bold">New:</span> Try our Demo Strategy with real execution on Avantis & 1inch!
              <span className="hidden sm:inline"> Uses just $20 USDC to test the full platform.</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href="https://github.com/yourusername/yourrepo/blob/main/DEMO_QUICK_START.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold px-3 py-1 bg-white text-blue-600 rounded-full hover:bg-blue-50 transition-colors whitespace-nowrap"
          >
            Quick Start →
          </a>
          <button
            onClick={handleDismiss}
            className="text-white hover:text-blue-100 transition-colors p-1"
            aria-label="Dismiss banner"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
