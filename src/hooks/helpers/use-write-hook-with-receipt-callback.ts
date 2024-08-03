import {
  Abi,
  type ContractFunctionArgs,
  ContractFunctionName,
  TransactionReceipt,
} from 'viem';
import {
  decodeEvmTransactionErrorResult,
  type DecodedContractError,
} from '../../utils/decode-evm-transaction-error';
import {
  useConfig,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { useWriteContractCallbacks } from './use-write-contract-callbacks';
import type {
  Config,
  ResolvedRegister,
  UseSimulateContractParameters,
} from 'wagmi';
import type {
  SimulateContractParameters,
  WriteContractErrorType,
} from 'wagmi/actions';
import { simulateContract } from 'wagmi/actions';

export const useWriteHookWithReceiptCallbacks = <
  const alternativeContractErrorAbi extends Abi | readonly unknown[],
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends ContractFunctionName<
    abi,
    'nonpayable' | 'payable'
  > = ContractFunctionName<abi, 'nonpayable' | 'payable'>,
  args extends ContractFunctionArgs<
    abi,
    'nonpayable' | 'payable',
    functionName
  > = ContractFunctionArgs<abi, 'nonpayable' | 'payable', functionName>,
  config extends Config = ResolvedRegister['config'],
  chainId extends
    | config['chains'][number]['id']
    | undefined = config['chains'][number]['id']
>({
  wagmiHookParameters,
  onError,
  onSuccess,
  onSettled,
  onStart,
  // Pass this extra abi, if you need to decode the error that is returned from a different contract than the one you are calling directly
  alternativeContractErrorAbi,
}: {
  wagmiHookParameters: UseSimulateContractParameters<
    abi,
    functionName,
    args,
    config,
    chainId
  >;
  onSuccess?: (data: TransactionReceipt) => void;
  onSettled?: (data?: TransactionReceipt) => void;
  onStart?: () => void;
  onError?: (
    error:
      | DecodedContractError<abi>
      | DecodedContractError<alternativeContractErrorAbi>
  ) => void;
  alternativeContractErrorAbi?: alternativeContractErrorAbi;
}) => {
  const wagmiConfig = useConfig();
  const simulateContractResponse = useSimulateContract(wagmiHookParameters);

  const onErrorWrite = (error: WriteContractErrorType) => {
    onError?.(
      decodeEvmTransactionErrorResult({ error, abi: wagmiHookParameters.abi })
    );
  };

  const onReverted = async (receipt: TransactionReceipt) => {
    if (receipt?.status === 'reverted') {
      // If writeContract didn't throw, but receipt has reverted, sometimes it is due to a race condition (a contract that calls other contracts), so we try to simulate the call again, and if it doesn't fail, we can assume that the transaction has succeeded
      try {
        const { functionName, abi, chainId, args, address } =
          wagmiHookParameters;

        const simulateParams = {
          functionName,
          abi,
          args,
          chainId,
          address,
        } as SimulateContractParameters;

        await simulateContract(
          wagmiHookParameters.config || wagmiConfig,
          simulateParams
        );
        onSuccess?.(receipt);
        onSettled?.(receipt);
      } catch (revertError: unknown) {
        if (alternativeContractErrorAbi) {
          onError?.(
            decodeEvmTransactionErrorResult({
              error: revertError,
              abi: alternativeContractErrorAbi,
            })
          );
        } else {
          onError?.(
            decodeEvmTransactionErrorResult({
              error: revertError,
              abi: wagmiHookParameters.abi,
            })
          );
        }
        onSettled?.(receipt);
      }
    }
  };

  const writeContractResponse = useWriteContract({
    mutation: { onError: onErrorWrite },
  });

  const waitForTransactionReceiptResponse = useWaitForTransactionReceipt({
    hash: writeContractResponse.data,
    query: {
      enabled:
        typeof wagmiHookParameters.query?.enabled === 'boolean'
          ? wagmiHookParameters.query.enabled
          : undefined,
    },
  });

  useWriteContractCallbacks({
    receipt: waitForTransactionReceiptResponse.data,
    isFetched: waitForTransactionReceiptResponse.isFetched,
    onSuccess,
    onSettled,
    onReverted,
  });

  const isAnyLoading =
    simulateContractResponse.isLoading ||
    writeContractResponse.isPending ||
    waitForTransactionReceiptResponse.isLoading;
  const isAnyError =
    simulateContractResponse.isError ||
    writeContractResponse.isError ||
    waitForTransactionReceiptResponse.isError;
  const refetch = simulateContractResponse.refetch;
  const anyError =
    simulateContractResponse.error ||
    writeContractResponse.error ||
    waitForTransactionReceiptResponse.error;

  const isSuccess =
    waitForTransactionReceiptResponse.isSuccess &&
    writeContractResponse.isSuccess &&
    simulateContractResponse.isSuccess;

  const onWrite = () => {
    if (
      simulateContractResponse.data?.request &&
      wagmiHookParameters.query?.enabled !== false
    ) {
      onStart?.();
      writeContractResponse.writeContract({
        functionName: wagmiHookParameters.functionName,
        abi: wagmiHookParameters.abi,
        args: wagmiHookParameters.args,
        ...(simulateContractResponse.data.request as any),
      });
    } else {
      console.warn('Hook config is not ready yet');
    }
  };

  if (anyError) {
    console.log('Hook error', {
      anyError,
      isAnyError,
    });
  }

  return {
    simulateContractResponse,
    writeContractResponse,
    waitForTransactionReceiptResponse,
    isAnyLoading,
    isAnyError,
    refetch,
    anyError,
    anyErrorMessage: decodeEvmTransactionErrorResult({
      error: anyError,
      abi: alternativeContractErrorAbi || wagmiHookParameters.abi,
    }).message,
    isSuccess,
    onWrite,
  };
};
