import { Account, AllowArray, Call, CallData, num, uint256 } from 'starknet';
import r from '../handlers/r';
import { chainContract } from '../other/constants';

export default class Payloads {

    static async getPayload (account: Account, dstAddress: string, amountToSend: bigint, tokenType: 'ETH' | 'STRK'): Promise<AllowArray<Call>> {
        if (tokenType === 'ETH') {
            return await this.transferPayloadETH(dstAddress, amountToSend, account);
        } else {
            return this.transferPayloadSTRK(dstAddress, amountToSend);
        }
    };

    static async transferPayloadETH (dstAddress: string, amountToSend: bigint, account: Account): Promise<AllowArray<Call>> {

        let txPayload: AllowArray<Call> = [{
            contractAddress: chainContract.ETH,
            entrypoint: 'transfer',
            calldata: CallData.compile({
                recipient: dstAddress,
                amount: uint256.bnToUint256(amountToSend),
            })
        }];

        const suggestedMaxFee: bigint = (await account.estimateInvokeFee(txPayload)).suggestedMaxFee;

        amountToSend = amountToSend - suggestedMaxFee - num.toBigInt(r.keepBalance());

        txPayload = [{
            contractAddress: chainContract.ETH,
            entrypoint: 'transfer',
            calldata: CallData.compile({
                recipient:dstAddress,
                amount: uint256.bnToUint256(amountToSend),
            })
        }];

        return txPayload;
    };

    static transferPayloadSTRK (dstAddress: string, amountToSend: bigint): AllowArray<Call> {
        return [{
            contractAddress: chainContract.STRK,
            entrypoint: 'transfer',
            calldata: CallData.compile({
                recipient: dstAddress,
                amount: uint256.bnToUint256(amountToSend),
            })
        }];
    };
}