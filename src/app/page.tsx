"use client";

import { useAppKit } from "@reown/appkit/react";
import { useAccount, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import wagmiNetworks from "@/config/wagmiNetworks";

export default function Home() {
  const { open } = useAppKit();
  const { disconnectAsync } = useDisconnect();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const networks = Object.values(wagmiNetworks);

  const login = () => {
    open({ view: "Connect" });
  };

  const logout = async () => {
    try {
      await disconnectAsync();
    } catch (err) {
      console.error("Failed to logout:", err);
    }
  };

  const handleChainChange = async (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const selectedChainId = parseInt(event.target.value);
    if (selectedChainId && selectedChainId !== chainId && switchChain) {
      try {
        await switchChain({ chainId: selectedChainId });
      } catch (error) {
        console.error("Failed to switch chain:", error);
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-5">
      {/* Navigation bar with wallet connection and chain selector */}
      <nav className="bg-[#F4F7FC] rounded-xl p-4 mb-8 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div className="font-mono text-xl font-bold text-gray-800">
            DeFi Strategy Platform
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isConnected && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="chain-selector"
                className="text-sm font-medium text-gray-700"
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
          {!isConnected ? (
            <button onClick={login} className="primary">
              Connect my wallet
            </button>
          ) : (
            <button onClick={logout} className="secondary">
              Disconnect
            </button>
          )}
        </div>
      </nav>

      {/* Main content area - ready for marketplace and strategy execution interfaces */}
      <section className="p-8 bg-[#F4F7FC] rounded-xl">
        {isConnected ? (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Welcome to DeFi Strategy Platform
            </h2>
            <p className="text-gray-600">
              Marketplace and strategy execution interfaces will be implemented here.
            </p>
          </div>
        ) : (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Connect Your Wallet
            </h2>
            <p className="text-gray-600 mb-6">
              Please connect your wallet to access the DeFi Strategy Platform.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
