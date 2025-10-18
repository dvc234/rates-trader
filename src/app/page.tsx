"use client";

import { useEffect, useState } from "react";
import { useAppKit } from "@reown/appkit/react";
import { useAccount, useDisconnect, useChainId, useSwitchChain } from "wagmi";
/**
 * iExec DataProtector SDK imports
 * 
 * IExecDataProtector: Main SDK class for initializing DataProtector with Web3 provider
 * IExecDataProtectorCore: Core API for protecting data and managing access grants
 * ProtectedData: Type representing encrypted data stored on iExec infrastructure
 * GrantedAccess: Type representing access permissions granted to apps/users
 * 
 * DataProtector enables:
 * - Encrypting sensitive data and storing it securely
 * - Granting granular access to specific apps and users
 * - Monetizing data access with RLC token pricing
 * - Revoking access when needed
 */
import {
  IExecDataProtector,
  IExecDataProtectorCore,
  ProtectedData,
  GrantedAccess,
} from "@iexec/dataprotector";
import WelcomeBlock from "@/components/WelcomeBlock";
import wagmiNetworks, { explorerSlugs } from "@/config/wagmiNetworks";

// External Link Icon Component
const ExternalLinkIcon = () => (
  <svg
    className="inline-block w-3 h-3 ml-1"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
    />
  </svg>
);

export default function Home() {
  const { open } = useAppKit();
  const { disconnectAsync } = useDisconnect();
  const { isConnected, connector, address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  /**
   * DataProtector State Management
   * 
   * dataProtectorCore: Initialized DataProtector API instance
   * - Created after wallet connection with Web3 provider
   * - Provides protectData() and grantAccess() methods
   * - Null until wallet is connected
   * 
   * REUSABLE PATTERN: This initialization pattern can be extracted into a service
   * for strategy purchase functionality
   */
  const [dataProtectorCore, setDataProtectorCore] =
    useState<IExecDataProtectorCore | null>(null);
  
  /**
   * Data Protection Form State
   * 
   * dataToProtect: User input for data to be encrypted
   * - name: Human-readable identifier for the protected data
   * - data: Actual content to encrypt (can be any JSON-serializable object)
   * 
   * REUSABLE PATTERN: For strategy purchase, this would contain:
   * - name: Strategy name
   * - data: Serialized strategy operations + metadata
   */
  const [dataToProtect, setDataToProtect] = useState({
    name: "",
    data: "",
  });
  
  /**
   * Protected Data Result
   * 
   * Contains metadata about successfully protected data:
   * - address: Unique identifier for the protected data (like an NFT address)
   * - name: The name provided during protection
   * - owner: Wallet address that owns the protected data
   * 
   * REUSABLE PATTERN: For strategy purchase, this address serves as proof of ownership
   */
  const [protectedData, setProtectedData] = useState<ProtectedData>();
  const [isLoading, setIsLoading] = useState(false);

  // iExec Web3Mail app addresses by chain
  const web3MailAddresses = {
    134: "0x781482c39cce25546583eac4957fb7bf04c277d2", // iExec Sidechain (Bellecour)
    42161: "0xd5054a18565c4a9e5c1aa3ceb53258bd59d4c78c", // Arbitrum One
  } as const;

  /**
   * Grant Access Form State
   * 
   * Manages parameters for granting access to protected data:
   * - protectedDataAddress: Address of the protected data to grant access to
   * - authorizedApp: iExec app address that can access the data (TEE executor)
   * - authorizedUser: Wallet address of user who can access (0x0000... for any user)
   * - pricePerAccess: Cost in nRLC (nano RLC) for each access
   * - numberOfAccess: How many times the data can be accessed
   * 
   * REUSABLE PATTERN: For strategy purchase, this enables:
   * - Seller grants access to buyer after RLC payment
   * - authorizedApp = TEE executor app address
   * - authorizedUser = buyer's wallet address
   * - pricePerAccess = strategy price in nRLC
   * - numberOfAccess = unlimited executions (high number)
   */
  const [grantAccessData, setGrantAccessData] = useState({
    protectedDataAddress: "",
    authorizedApp: "",
    authorizedUser: "",
    pricePerAccess: 0,
    numberOfAccess: 1,
  });
  
  /**
   * Granted Access Result
   * 
   * Contains details about successfully granted access:
   * - dataset: Protected data address
   * - datasetprice: Price per access in nRLC
   * - volume: Number of accesses granted
   * - apprestrict: Authorized app address
   * - requesterrestrict: Authorized user address
   * 
   * REUSABLE PATTERN: This serves as proof that a user has purchased a strategy
   */
  const [grantedAccess, setGrantedAccess] = useState<GrantedAccess>();
  const [isGrantingAccess, setIsGrantingAccess] = useState(false);

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

  // Get Web3Mail address for current chain
  const getCurrentWeb3MailAddress = () => {
    return web3MailAddresses[chainId as keyof typeof web3MailAddresses] || "";
  };

  // Get explorer URL for current chain using iExec explorer
  const getExplorerUrl = (
    address: string | undefined,
    type: "address" | "dataset" | "apps" = "address"
  ) => {
    const explorerSlug = explorerSlugs[chainId];
    if (!explorerSlug) return null;

    if (!address) return `https://explorer.iex.ec/${explorerSlug}/${type}`;
    return `https://explorer.iex.ec/${explorerSlug}/${type}/${address}`;
  };

  /**
   * DataProtector Initialization Effect
   * 
   * Initializes DataProtector when wallet is connected:
   * 1. Gets Web3 provider from wagmi connector
   * 2. Creates IExecDataProtector instance with provider
   * 3. Extracts core API for protectData() and grantAccess()
   * 
   * Configuration:
   * - allowExperimentalNetworks: true - Enables testnet support (Arbitrum Sepolia)
   * 
   * REUSABLE PATTERN: This initialization should be extracted into a service class:
   * - StrategyDataProtectorService.initialize(provider)
   * - Returns initialized dataProtectorCore
   * - Can be reused across marketplace and execution components
   * 
   * Dependencies: Re-initializes when wallet connection changes
   */
  useEffect(() => {
    const initializeDataProtector = async () => {
      if (isConnected && connector) {
        try {
          // Get EIP-1193 provider from wagmi connector
          const provider =
            (await connector.getProvider()) as import("ethers").Eip1193Provider;
          
          // Initialize DataProtector with Web3 provider
          const dataProtector = new IExecDataProtector(provider, {
            allowExperimentalNetworks: true, // Required for Arbitrum Sepolia
          });
          
          // Extract core API for data operations
          setDataProtectorCore(dataProtector.core);
        } catch (error) {
          console.error("Failed to initialize data protector:", error);
        }
      }
    };

    initializeDataProtector();
  }, [isConnected, connector]);

  /**
   * Grant Access to Protected Data
   * 
   * Grants permission for a specific app and/or user to access protected data.
   * This is a critical step in the strategy purchase flow.
   * 
   * Flow:
   * 1. User submits grant access form
   * 2. DataProtector creates an on-chain access grant
   * 3. Authorized app can now access the encrypted data in TEE
   * 4. Access can be monetized with RLC pricing
   * 
   * Parameters:
   * - protectedData: Address of the protected data (from protectData result)
   * - authorizedApp: iExec app address (TEE executor) that can access data
   * - authorizedUser: Wallet address that can trigger access (0x0000... = anyone)
   * - pricePerAccess: Cost in nRLC for each access (0 = free)
   * - numberOfAccess: Maximum number of times data can be accessed
   * - onStatusUpdate: Callback for transaction progress updates
   * 
   * REUSABLE PATTERN: For strategy purchase:
   * - Strategy seller calls this after buyer pays RLC
   * - protectedData = encrypted strategy operations address
   * - authorizedApp = TEE strategy executor app address
   * - authorizedUser = buyer's wallet address
   * - pricePerAccess = 0 (already paid upfront)
   * - numberOfAccess = 999999 (unlimited executions)
   * 
   * Returns: GrantedAccess object with access details
   * - Can be used to verify ownership before execution
   * - Contains all restriction parameters for validation
   */
  const grantDataAccess = async (event: React.FormEvent) => {
    event.preventDefault();
    if (dataProtectorCore) {
      setIsGrantingAccess(true);
      try {
        // Call DataProtector grantAccess API
        const result = await dataProtectorCore.grantAccess({
          protectedData: grantAccessData.protectedDataAddress,
          authorizedApp: grantAccessData.authorizedApp,
          authorizedUser: grantAccessData.authorizedUser,
          pricePerAccess: grantAccessData.pricePerAccess,
          numberOfAccess: grantAccessData.numberOfAccess,
          // Progress callback for UX feedback
          onStatusUpdate: ({
            title,
            isDone,
          }: {
            title: string;
            isDone: boolean;
          }) => {
            console.log(`Grant Access Status: ${title}, Done: ${isDone}`);
          },
        });
        console.log("Granted Access:", result);
        setGrantedAccess(result);
      } catch (error) {
        console.error("Error granting access:", error);
        // REUSABLE PATTERN: Add user-friendly error handling here
      } finally {
        setIsGrantingAccess(false);
      }
    }
  };

  /**
   * Protect Data with DataProtector
   * 
   * Encrypts and stores data on iExec infrastructure.
   * This is the first step in creating purchasable strategies.
   * 
   * Flow:
   * 1. User provides name and data to protect
   * 2. DataProtector encrypts the data
   * 3. Encrypted data is stored on iExec infrastructure
   * 4. Returns protected data address (unique identifier)
   * 
   * Parameters:
   * - name: Human-readable identifier for the protected data
   * - data: Object containing the actual data to encrypt
   *   - Can be any JSON-serializable object
   *   - In this demo: { email: string }
   * 
   * REUSABLE PATTERN: For strategy creation:
   * - name: Strategy name (e.g., "Funding Rate Arbitrage Strategy")
   * - data: {
   *     operations: serializedOperations, // Array of strategy operations
   *     metadata: {
   *       description: "Strategy description",
   *       riskLevel: "medium",
   *       aprRange: { min: 5, max: 15 },
   *       version: "1.0.0"
   *     }
   *   }
   * 
   * Returns: ProtectedData object
   * - address: Unique identifier (used for granting access)
   * - name: The name provided
   * - owner: Wallet address that created the protected data
   * 
   * Security: Data is encrypted client-side before transmission
   * Only authorized apps in TEE can decrypt the data
   */
  const protectData = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (dataProtectorCore) {
      setIsLoading(true);
      try {
        // Call DataProtector protectData API
        const protectedData = await dataProtectorCore.protectData({
          name: dataToProtect.name,
          data: {
            // Data object can contain any JSON-serializable content
            email: dataToProtect.data,
            // REUSABLE PATTERN: For strategies, include:
            // operations: serializedStrategyOperations,
            // metadata: { description, riskLevel, aprRange, etc. }
          },
        });
        console.log("Protected Data:", protectedData);
        setProtectedData(protectedData);
      } catch (error) {
        console.error("Error protecting data:", error);
        // REUSABLE PATTERN: Add user-friendly error handling here
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-5">
      <nav className="bg-[#F4F7FC] rounded-xl p-4 mb-8 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div className="font-mono text-xl font-bold text-gray-800">
            iExec NextJs Starter
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

      <WelcomeBlock />

      <section className="p-8 bg-[#F4F7FC] rounded-xl">
        {isConnected ? (
          <div>
            <h2 className="mb-6 text-2xl font-semibold text-gray-800">
              Protect my data
            </h2>
            <form onSubmit={protectData} className="mb-8">
              <div className="mb-5">
                <label
                  htmlFor="data_name"
                  className="block mb-2 font-medium text-gray-700"
                >
                  Data name to protect
                </label>
                <input
                  onChange={(e) =>
                    setDataToProtect((prevData) => ({
                      ...prevData,
                      name: e.target.value,
                    }))
                  }
                  type="text"
                  id="data_name"
                  placeholder="Name to identify your data"
                  value={dataToProtect.name}
                  maxLength={100}
                />
              </div>
              <div className="mb-5">
                <label
                  htmlFor="data_content"
                  className="block mb-2 font-medium text-gray-700"
                >
                  Data to protect
                </label>
                <input
                  onChange={(e) =>
                    setDataToProtect((prevData) => ({
                      ...prevData,
                      data: e.target.value,
                    }))
                  }
                  type="text"
                  id="data_content"
                  placeholder="Enter text to protect"
                  value={dataToProtect.data}
                  maxLength={500}
                />
              </div>
              <button
                disabled={
                  !dataToProtect.name || !dataToProtect.data || isLoading
                }
                className="primary"
                type="submit"
              >
                {isLoading ? "Protecting data..." : "Protect my data"}
              </button>
            </form>

            {protectedData && (
              <div className="bg-blue-100 border border-blue-300 rounded-xl p-6 mt-6">
                <h3 className="text-blue-800 mb-4 text-lg font-semibold">
                  ✅ Data protected successfully!
                </h3>
                <div className="text-blue-800 space-y-2 text-sm">
                  <p>
                    <strong>Name:</strong> {protectedData.name}
                  </p>
                  <p>
                    <strong>Address:</strong> {protectedData.address}
                    {getExplorerUrl(protectedData.address, "dataset") && (
                      <a
                        href={getExplorerUrl(protectedData.address, "dataset")!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        View Protected Data <ExternalLinkIcon />
                      </a>
                    )}
                  </p>
                  <p>
                    <strong>Owner:</strong> {protectedData.owner}
                    {getExplorerUrl(protectedData.owner, "address") && (
                      <a
                        href={getExplorerUrl(protectedData.owner, "address")!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        View Address
                        <ExternalLinkIcon />
                      </a>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Grant Access Form */}
            <div className="mt-12 pt-8 border-t border-gray-200">
              <h2 className="mb-6 text-2xl font-semibold text-gray-800">
                Grant Access to Protected Data
              </h2>
              <form onSubmit={grantDataAccess} className="mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label
                      htmlFor="protected_data_address"
                      className="block mb-2 font-medium text-gray-700"
                    >
                      Protected Data Address *
                    </label>
                    <input
                      value={grantAccessData.protectedDataAddress}
                      onChange={(e) =>
                        setGrantAccessData((prev) => ({
                          ...prev,
                          protectedDataAddress: e.target.value,
                        }))
                      }
                      type="text"
                      id="protected_data_address"
                      placeholder="0x123abc..."
                      maxLength={42}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Address of the protected data you own
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setGrantAccessData((prev) => ({
                          ...prev,
                          protectedDataAddress: protectedData?.address || "",
                        }))
                      }
                      disabled={!protectedData?.address}
                      className="mt-1 secondary h-9"
                    >
                      Use previously created Protected Data
                    </button>
                  </div>

                  <div>
                    <label
                      htmlFor="authorized_user"
                      className="block mb-2 font-medium text-gray-700"
                    >
                      Authorized User Address *
                    </label>
                    <input
                      value={grantAccessData.authorizedUser}
                      onChange={(e) =>
                        setGrantAccessData((prev) => ({
                          ...prev,
                          authorizedUser: e.target.value,
                        }))
                      }
                      type="text"
                      id="authorized_user"
                      placeholder="0x789cba... or 0x0000... for all users"
                      maxLength={42}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      User who can access the data (use 0x0000... for all users)
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setGrantAccessData((prev) => ({
                          ...prev,
                          authorizedUser: address || "",
                        }))
                      }
                      disabled={!address}
                      className="mt-1 secondary h-9"
                    >
                      Use current wallet address
                    </button>
                  </div>

                  <div>
                    <label
                      htmlFor="authorized_app"
                      className="block mb-2 font-medium text-gray-700"
                    >
                      Authorized iApp Address *
                    </label>
                    <input
                      value={grantAccessData.authorizedApp}
                      onChange={(e) =>
                        setGrantAccessData((prev) => ({
                          ...prev,
                          authorizedApp: e.target.value,
                        }))
                      }
                      type="text"
                      id="authorized_app"
                      placeholder="Enter iApp address (0x...)"
                      maxLength={42}
                      required
                    />
                    <div className="text-xs text-gray-500 mt-2 space-y-1">
                      <p>
                        iApp authorized to access your protected data.
                      </p>
                      <p className="text-gray-400 mt-1">
                        iApp addresses vary by chain. Always verify before
                        granting access.
                      </p>
                      {getExplorerUrl("apps") && (
                        <a
                          href={getExplorerUrl("apps")!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          See available iApp on Explorer <ExternalLinkIcon />
                        </a>
                      )}
                    </div>
                    {getCurrentWeb3MailAddress() && (
                      <button
                        type="button"
                        onClick={() =>
                          setGrantAccessData((prev) => ({
                            ...prev,
                            authorizedApp: getCurrentWeb3MailAddress(),
                          }))
                        }
                        className="mt-2 secondary h-9"
                      >
                        Use Web3Mail Whitelist address for current chain
                      </button>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="number_of_access"
                      className="block mb-2 font-medium text-gray-700"
                    >
                      Number of Access
                    </label>
                    <input
                      value={grantAccessData.numberOfAccess}
                      onChange={(e) =>
                        setGrantAccessData((prev) => ({
                          ...prev,
                          numberOfAccess: parseInt(e.target.value) || 1,
                        }))
                      }
                      type="number"
                      id="number_of_access"
                      placeholder="1"
                      min="1"
                      max="10000"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      How many times the data can be accessed
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <label
                      htmlFor="price_per_access"
                      className="block mb-2 font-medium text-gray-700"
                    >
                      Price Per Access (nRLC)
                    </label>
                    <input
                      value={grantAccessData.pricePerAccess}
                      onChange={(e) =>
                        setGrantAccessData((prev) => ({
                          ...prev,
                          pricePerAccess: parseFloat(e.target.value) || 0,
                        }))
                      }
                      type="number"
                      id="price_per_access"
                      placeholder="0"
                      min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Fee in nano RLC for each access (1 RLC = 10^9 nRLC)
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    disabled={
                      !grantAccessData.protectedDataAddress ||
                      !grantAccessData.authorizedUser ||
                      !grantAccessData.authorizedApp ||
                      isGrantingAccess
                    }
                    className="primary"
                    type="submit"
                  >
                    {isGrantingAccess ? "Granting Access..." : "Grant Access"}
                  </button>
                </div>
              </form>

              {grantedAccess && (
                <div className="bg-blue-100 border border-blue-300 rounded-xl p-6 mt-6">
                  <h3 className="text-blue-800 mb-4 text-lg font-semibold">
                    ✅ Access granted successfully!
                  </h3>
                  <div className="text-blue-800 space-y-2 text-sm">
                    <p>
                      <strong>Protected Data:</strong> {grantedAccess.dataset}
                      {getExplorerUrl(grantedAccess.dataset, "dataset") && (
                        <a
                          href={
                            getExplorerUrl(grantedAccess.dataset, "dataset")!
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          View Protected Data
                          <ExternalLinkIcon />
                        </a>
                      )}
                    </p>
                    <p>
                      <strong>Protected Data Price:</strong>{" "}
                      {grantedAccess.datasetprice} nRLC
                    </p>
                    <p>
                      <strong>Volume:</strong> {grantedAccess.volume}
                    </p>
                    <p>
                      <strong>iApp Restrict:</strong> {grantedAccess.apprestrict}
                    </p>
                    <p>
                      <strong>Workerpool Restrict:</strong>{" "}
                      {grantedAccess.workerpoolrestrict}
                    </p>
                    <p>
                      <strong>Requester Restrict:</strong>{" "}
                      {grantedAccess.requesterrestrict}
                      {grantedAccess.requesterrestrict !==
                        "0x0000000000000000000000000000000000000000" &&
                        getExplorerUrl(
                          grantedAccess.requesterrestrict,
                          "address"
                        ) && (
                          <a
                            href={
                              getExplorerUrl(
                                grantedAccess.requesterrestrict,
                                "address"
                              )!
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            View Requester
                            <ExternalLinkIcon />
                          </a>
                        )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 px-6">
            <h2 className="mb-4 text-xl text-gray-600">
              Connect your wallet to get started
            </h2>
            <p className="text-gray-500 mb-6">
              You need to connect your wallet to use data protection features.
            </p>
            <button onClick={login} className="primary">
              Connect my wallet
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
