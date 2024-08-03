import { useEffect, useCallback } from 'react';
import { TransactionReceipt, WriteContractErrorType } from 'viem';

type Props = {
  error?: WriteContractErrorType | null;
  receipt: TransactionReceipt | undefined;
  isFetched: boolean;
  onSuccess?: (data: TransactionReceipt) => void;
  onSettled?: (
    data: TransactionReceipt | undefined,
    error?: WriteContractErrorType | null
  ) => void;
  onReverted?: (receipt: TransactionReceipt) => Promise<void>;
};

// Execute callbacks when transaction confirmation receipt is received.
// onSettled is called on both success and error.
export const useWriteContractCallbacks = ({
  receipt,
  isFetched,
  onSuccess,
  onSettled,
  onReverted,
}: Props) => {
  const onRevertedCallback = useCallback(
    async (receipt: TransactionReceipt) => {
      if (onReverted) {
        await onReverted(receipt);
      }
      onSettled?.(receipt);
    },
    [onSettled, onReverted]
  );

  useEffect(() => {
    if (isFetched && !!receipt) {
      switch (receipt.status) {
        case 'success': {
          onSuccess?.(receipt);
          onSettled?.(receipt, null);
          break;
        }
        case 'reverted': {
          void onRevertedCallback(receipt);
          break;
        }
      }
    }
    //Important to not add onRevertedCallback to deps array to avoid too many rerenders
  }, [isFetched, receipt]);
};
