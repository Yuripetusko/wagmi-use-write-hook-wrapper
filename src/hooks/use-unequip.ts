import { TransactionReceipt, Address } from 'viem';
import { ResolvedRegister } from 'wagmi';
import { RMRKEquippableImpl } from '../abis/RMRKEquippableImpl';
import { useWriteHookWithReceiptCallbacks } from './helpers/use-write-hook-with-receipt-callback';
import { type DecodedContractError } from '../utils/decode-evm-transaction-error';

type Arguments = {
  slotId: bigint;
  parentCatalogAssetId: bigint;
  parentAddress: Address;
  parentNftId: bigint;
  onSuccess?: (data: TransactionReceipt) => void;
  onSettled?: (data?: TransactionReceipt) => void;
  onError?: (error: DecodedContractError<typeof RMRKEquippableImpl>) => void;
  chainId: ResolvedRegister['config']['chains'][number]['id'];
};

type Options = {
  skip?: boolean;
};

export const useUnequip = (args: Arguments, options?: Options) => {
  const {
    parentAddress,
    parentNftId,
    parentCatalogAssetId,
    slotId,
    onError,
    onSuccess,
    onSettled,
    chainId,
  } = args;
  const { skip = false } = options || {};

  const { isAnyError, isSuccess, isAnyLoading, anyError, refetch, onWrite } =
    useWriteHookWithReceiptCallbacks({
      wagmiHookParameters: {
        chainId,
        address: parentAddress,
        args: [parentNftId, parentCatalogAssetId, slotId],
        abi: RMRKEquippableImpl,
        functionName: 'unequip',
        query: { enabled: !skip },
      },
      onError,
      onSuccess,
      onSettled,
      // Not needed here, but adding as an example
      alternativeContractErrorAbi: RMRKEquippableImpl,
    });

  return {
    error: anyError,
    isLoading: isAnyLoading,
    isSuccess,
    isError: isAnyError,
    onUnequip: onWrite,
    refetch,
  };
};
