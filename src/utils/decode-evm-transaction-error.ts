import { Abi } from 'abitype';
import {
  AbiErrorSignatureNotFoundError,
  BaseError,
  ContractFunctionExecutionError,
  ContractFunctionExecutionErrorType,
  ContractFunctionRevertedError,
  SimulateContractErrorType,
  WaitForTransactionReceiptErrorType,
  WriteContractErrorType,
  decodeErrorResult,
} from 'viem';

export interface ParseEvmTransactionLogArgs<
  TAbi extends Abi | readonly unknown[] | undefined
> {
  abi: TAbi;
  error:
    | unknown
    | ContractFunctionExecutionErrorType
    | SimulateContractErrorType
    | WriteContractErrorType
    | WaitForTransactionReceiptErrorType
    | null;
}

/**
 * Tries to find decoded error in the error object, or decodes it with the supplied ABI.
 * @param error
 * @param abi
 */
export const decodeEvmTransactionErrorResult = <
  TAbi extends Abi | readonly unknown[] | undefined
>({
  error,
  abi,
}: ParseEvmTransactionLogArgs<TAbi>) => {
  try {
    if (
      error instanceof BaseError ||
      error instanceof ContractFunctionExecutionError
    ) {
      const revertError = error.walk(
        (err) => err instanceof ContractFunctionRevertedError
      );
      if (revertError instanceof ContractFunctionRevertedError) {
        const errorName = revertError.data?.errorName ?? '';

        if (errorName) {
          // This error is already decoded
          const decodedError = revertError.data;
          return {
            error,
            decodedError,
            message: error?.shortMessage ?? error?.message,
          };
        }
      }
    }

    // If error could not be decoded with original abi, let's try to decode it with the supplied ABI
    const noSignatureError = (error as BaseError).walk(
      (err) => err instanceof AbiErrorSignatureNotFoundError
    );
    if (
      noSignatureError instanceof AbiErrorSignatureNotFoundError &&
      noSignatureError?.signature
    ) {
      const decodedError = decodeErrorResult({
        abi,
        data: noSignatureError.signature,
      });

      return {
        decodedError,
        error,
        message:
          (error as ContractFunctionRevertedError)?.shortMessage ??
          (error as Error)?.message,
      };
    }
    return {
      error,
      decodedError: undefined,
      message:
        (error as ContractFunctionRevertedError)?.shortMessage ??
        (error as Error)?.message ??
        !!error
          ? 'Unknown error'
          : undefined,
    };
  } catch (_) {
    return {
      error,
      decodedError: undefined,
      message:
        (error as ContractFunctionRevertedError)?.shortMessage ??
        (error as Error)?.message ??
        !!error
          ? 'Unknown error'
          : undefined,
    };
  }
};

export type DecodedContractError<
  TAbi extends Abi | readonly unknown[] | undefined
> = ReturnType<typeof decodeEvmTransactionErrorResult<TAbi>>;
