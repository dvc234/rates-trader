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
      {/* Navigation Bar - reuses existing nav bar with wallet connection */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Brand */}
            <div className="flex items-center">
              <div className="font-mono text-xl font-bold text-gray-800">
                DeFi Strategy Platform
              </div>
            </div>

            {/* Wallet Connection and Network Selector */}
            <div className="flex items-center gap-4">
              {/* Network Selector - only shown when wallet is connected */}
              {isConnected && (
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="chain-selector"
                    className="text-sm font-medium text-gray-700 hidden sm:block"
                  >
                    Chain:
                  </label>
                  <select
                    id="chain-selector"
                    value={chainId}
                    onChange={handleChainChange}
                    className="chain-selector"
                  >
                    {networks?.map((network) => (
                      <option key={network.id} value={network.id}>
                        {network.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Wallet Connection Button */}
              {!isConnected ? (
                <button onClick={login} className="primary">
                  Connect Wallet
                </button>
              ) : (
                <button onClick={logout} className="secondary">
                  Disconnect
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Two-Tab Navigation Interface */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tab Headers */}
        <div className="bg-white rounded-t-xl border border-gray-200 border-b-0">
          <div className="flex border-b border-gray-200">
            {/* Marketplace Tab */}
            <button
              onClick={() => handleTabChange('marketplace')}
              className={`
                flex-1 px-6 py-4 text-sm font-medium transition-colors duration-200
                ${
                  activeTab === 'marketplace'
                    ? 'text-primary border-b-2 border-primary bg-blue-50/50'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }
              `}
            >
              <div className="flex items-center justify-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
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

            {/* My Strategies Tab */}
            <button
              onClick={() => handleTabChange('my-strategies')}
              className={`
                flex-1 px-6 py-4 text-sm font-medium transition-colors duration-200
                ${
                  activeTab === 'my-strategies'
                    ? 'text-primary border-b-2 border-primary bg-blue-50/50'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }
              `}
            >
              <div className="flex items-center justify-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span>My Strategies</span>
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content Area - Mobile-responsive layout */}
        <div className="bg-white rounded-b-xl border border-gray-200 border-t-0 p-6 sm:p-8 min-h-[500px]">
          {/* Render content based on active tab */}
          {activeTab === 'marketplace' ? (
            marketplaceContent || (
              <div className="text-center py-12">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  Marketplace
                </h3>
                <p className="text-gray-600">
                  Browse and purchase encrypted trading strategies
                </p>
              </div>
            )
          ) : (
            myStrategiesContent || (
              <div className="text-center py-12">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  My Strategies
                </h3>
                <p className="text-gray-600">
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
