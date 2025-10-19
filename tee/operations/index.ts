/**
 * TEE Operations Module
 * 
 * This module exports all operation-related interfaces and types used in the TEE.
 * Operations follow the Command pattern and are executed sequentially within
 * the Trusted Execution Environment.
 */

export { IOperation } from './IOperation';
export { 
  OperationType, 
  ValidationResult, 
  OperationResult, 
  OperationError 
} from './OperationTypes';
export { MockOperation } from './MockOperation';
export { CheckFundingRateOperation } from './CheckFundingRateOperation';
export { OpenPerpetualShortOperation } from './OpenPerpetualShortOperation';
export { SpotBuyOperation } from './SpotBuyOperation';
