/**
 * AppLayout Component
 * 
 * Main application layout with navigation between Marketplace and My Strategies views.
 * Includes wallet connection in the navigation bar and responsive design.
 * 
 * @component
 */

'use client';

import { useState } from 'react';
import { useAppKit } from '@reown/appkit/react';
import { useAccount, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import wagmiNetworks from '@/config/wagmiNetworks';
import DemoBanner from './DemoBanner';

/**
 * Props for the AppLayout component
 */
interface AppLayoutProps {
  /** Content to render in the marketplace tab */
  marketplaceContent?: React.ReactNode;
  /** Content to render in the my strategies tab */
  myStrategiesContent?: React.ReactNode;
}

/**
 * Available navigation tabs
 */
type TabType = 'marketplace' | 'my-strategies';

/**
 * AppLayout provides the main application structure with:
 * - Navigation bar with wallet connection
 * - Two-tab interface (Marketplace and My Strategies)
 * - Network selector
 * - Mobile-responsive layout
 */
export default function AppLayout({ marketplaceContent, myStrategiesContent }: AppLayoutProps) {
  // Active tab state management
  const [activeTab, setActiveTab] = useState<TabType>('marketplace');

  // Wallet and network hooks
  const { open } = useAppKit();
  const { disconnectAsync } = useDisconnect();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const networks = Object.values(wagmiNetworks);

  /**
   * Opens wallet connection modal
   */
  const login = () => {
    open({ view: 'Connect' });
  };

  /**
   * Disconnects the wallet
   */
  const logout = async () => {
    try {
      await disconnectAsync();
    } catch (err) {
      console.error('Failed to logout:', err);
    }
  };

  /**
   * Handles network switching
   */
  const handleChainChange = async (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const selectedChainId = parseInt(event.target.value);
    if (selectedChainId && selectedChainId !== chainId && switchChain) {
      try {
        switchChain({ chainId: selectedChainId });
      } catch (error) {
        console.error('Failed to switch chain:', error);
      }
    }
  };

  /**
   * Handles tab navigation
   */
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Demo Banner - Dismissible promotional banner */}
      <DemoBanner />

      {/* Navigation Bar - Sticky header with wallet connection and network selector */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Brand - Responsive text sizing */}
            <div className="flex items-center">
              <div className="font-mono text-lg sm:text-xl font-bold text-gray-800">
                <span className="hidden sm:inline">DeFi Strategy Platform</span>
                <span className="sm:hidden">DeFi Strategies</span>
              </div>
            </div>

            {/* Wallet Connection and Network Selector - Responsive layout */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Network Selector - only shown when wallet is connected */}
              {isConnected && (
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="chain-selector"
                    className="text-sm font-medium text-gray-700 hidden md:block"
                  >
                    Chain:
                  </label>
                  <select
                    id="chain-selector"
                    value={chainId}
                    onChange={handleChainChange}
                    className="chain-selector text-xs sm:text-sm"
                    aria-label="Select blockchain network"
                  >
                    {networks?.map((network) => (
                      <option key={network.id} value={network.id}>
                        {network.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Wallet Connection Button - Responsive sizing */}
              {!isConnected ? (
                <button
                  onClick={login}
                  className="primary text-xs sm:text-sm px-3 sm:px-6"
                  aria-label="Connect wallet"
                >
                  <span className="hidden sm:inline">Connect Wallet</span>
                  <span className="sm:hidden">Connect</span>
                </button>
              ) : (
                <button
                  onClick={logout}
                  className="secondary text-xs sm:text-sm px-3 sm:px-6"
                  aria-label="Disconnect wallet"
                >
                  <span className="hidden sm:inline">Disconnect</span>
                  <span className="sm:hidden">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Two-Tab Navigation Interface - Responsive container */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
        {/* Tab Headers - Mobile-optimized tabs */}
        <div className="bg-white rounded-t-xl border border-gray-200 border-b-0 shadow-sm">
          <div className="flex border-b border-gray-200">
            {/* Marketplace Tab - Responsive padding and text */}
            <button
              onClick={() => handleTabChange('marketplace')}
              className={`
                flex-1 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-all duration-200
                ${activeTab === 'marketplace'
                  ? 'text-primary border-b-2 border-primary bg-blue-50/50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }
              `}
              aria-label="View marketplace"
              aria-selected={activeTab === 'marketplace'}
              role="tab"
            >
              <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <span>Marketplace</span>
              </div>
            </button>

            {/* My Strategies Tab - Responsive padding and text */}
            <button
              onClick={() => handleTabChange('my-strategies')}
              className={`
                flex-1 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-all duration-200
                ${activeTab === 'my-strategies'
                  ? 'text-primary border-b-2 border-primary bg-blue-50/50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }
              `}
              aria-label="View my strategies"
              aria-selected={activeTab === 'my-strategies'}
              role="tab"
            >
              <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="hidden xs:inline sm:inline">My Strategies</span>
                <span className="xs:hidden sm:hidden">My</span>
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content Area - Mobile-responsive padding and min-height */}
        <div className="bg-white rounded-b-xl border border-gray-200 border-t-0 p-4 sm:p-6 lg:p-8 min-h-[400px] sm:min-h-[500px] shadow-sm animate-fadeIn">
          {/* Render content based on active tab with fade-in animation */}
          {activeTab === 'marketplace' ? (
            marketplaceContent || (
              <div className="text-center py-12">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">
                  Marketplace
                </h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Browse and purchase encrypted trading strategies
                </p>
              </div>
            )
          ) : (
            myStrategiesContent || (
              <div className="text-center py-12">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">
                  My Strategies
                </h3>
                <p className="text-sm sm:text-base text-gray-600">
                  View and execute your purchased strategies
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
