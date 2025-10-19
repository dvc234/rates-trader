// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AvantisPositionPredicate
 * @notice Smart contract predicate for 1inch Fusion conditional orders
 * @dev Verifies Avantis short positions are confirmed before allowing Fusion orders to execute
 * 
 * Avantis Protocol: https://docs.avantisfi.com/
 * 
 * Flow:
 * 1. TEE opens short position on Avantis
 * 2. TEE creates 1inch Fusion order with this predicate
 * 3. Fusion resolvers call checkShortPositionConfirmed()
 * 4. When predicate returns true, resolvers execute the spot buy
 * 
 * This ensures proper delta-neutral positioning.
 */

/**
 * @notice Avantis Trade struct
 * @dev Represents an open position on Avantis
 */
struct Trade {
    address trader;
    uint256 pairIndex;
    uint256 index;
    uint256 initialPosToken;
    uint256 positionSizeUsdc;
    uint256 openPrice;        // 1e10 precision
    bool buy;                 // true = long, false = short
    uint256 leverage;
    uint256 tp;
    uint256 sl;
}

/**
 * @notice Avantis Trading interface
 */
interface IAvantisTrading {
    function openTrades(
        address trader,
        uint256 pairIndex,
        uint256 index
    ) external view returns (Trade memory);
}

contract AvantisPositionPredicate {
    
    /// @notice Avantis Trading contract address
    address public immutable avantisTrading;
    
    /// @notice Maximum price deviation allowed (1%)
    uint256 public constant MAX_PRICE_DEVIATION_BPS = 100;
    
    /// @notice Event emitted when a short position is confirmed
    event ShortPositionConfirmed(
        address indexed trader,
        uint256 indexed pairIndex,
        uint256 tradeIndex,
        uint256 openPrice
    );
    
    /**
     * @notice Constructor
     * @param _avantisTrading Address of the Avantis Trading contract
     */
    constructor(address _avantisTrading) {
        require(_avantisTrading != address(0), "Invalid Avantis address");
        avantisTrading = _avantisTrading;
    }
    
    /**
     * @notice Main predicate function called by 1inch Fusion resolvers
     * @dev Checks if short position is confirmed and valid
     * 
     * @param trader Address of the trader
     * @param pairIndex Avantis pair index (e.g., 0 for BTC/USD)
     * @param tradeIndex Trade index for this trader
     * @param expectedOpenPrice Expected entry price (1e10 precision)
     * @return canExecute True if all validation checks pass
     * @return actualOpenPrice Actual confirmed entry price from Avantis (1e10 precision)
     */
    function checkShortPositionConfirmed(
        address trader,
        uint256 pairIndex,
        uint256 tradeIndex,
        uint256 expectedOpenPrice
    ) external view returns (bool canExecute, uint256 actualOpenPrice) {
        // Expected price must be non-zero to prevent division by zero
        if (expectedOpenPrice == 0) {
            return (false, 0);
        }
        
        Trade memory trade = IAvantisTrading(avantisTrading).openTrades(
            trader,
            pairIndex,
            tradeIndex
        );
        
        // Position must exist
        if (trade.trader == address(0)) {
            return (false, 0);
        }
        
        // Position must belong to trader
        if (trade.trader != trader) {
            return (false, 0);
        }
        
        // Position must be a short
        if (trade.buy) {
            return (false, 0);
        }
        
        // Position must have size
        if (trade.positionSizeUsdc == 0) {
            return (false, 0);
        }
        
        // Entry price must be within acceptable range (1% deviation)
        uint256 priceDiff = trade.openPrice > expectedOpenPrice 
            ? trade.openPrice - expectedOpenPrice 
            : expectedOpenPrice - trade.openPrice;
        
        uint256 maxDeviation = (expectedOpenPrice * MAX_PRICE_DEVIATION_BPS) / 10000;
        
        if (priceDiff > maxDeviation) {
            return (false, 0);
        }
        
        // All checks passed - emit event and return success
        emit ShortPositionConfirmed(trader, pairIndex, tradeIndex, trade.openPrice);
        
        return (true, trade.openPrice);
    }
}
