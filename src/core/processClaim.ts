import DbContext from '../lowdb/DbContext';
import Logger from '../other/logger';
import { AddressData } from '../lowdb/types';
import { Account, AllowArray, cairo, Call, CallData, RpcProvider } from 'starknet';
import { General } from '../../config';
import TxConfirmation from '../other/txConfirmation';
import { chainContract } from '../other/constants';
import BalanceHandler from '../handlers/balanceHandler';



export async function processClaim (dbContext: DbContext, logger: Logger, addressData: AddressData, moduleStr: string) {

    try {
        if (addressData.claim.status === 'done') {
            await logger.info({
                message: 'Claim already done.',
                moduleString: moduleStr
            });
            return;
        }


        const provider: RpcProvider = new RpcProvider({ nodeUrl: General.rpc[0] });
        const account: Account = new Account(provider, addressData.info.address, addressData.info.privateKey, '1');

        // TODO получение пейлоуда
        // TODO пока пример из транзы просто рандомной
        const payload: AllowArray<Call> = {
            contractAddress: chainContract.claim,
            entrypoint: 'claim',
            calldata: CallData.compile(
                [
                    {
                        identity: addressData.info.address,
                        balance: cairo.uint256(Number(addressData.someResponse.amount) * 10 ** 18),
                        index: addressData.someResponse.merkle_index,
                        merkle_path: addressData.someResponse.merkle_path
                    }
                ]
            )
        };

        addressData.claim.balanceCash = 0;
        // TODO получить amount возможно через контракт
        addressData.claim.amount = Number(addressData.someResponse.amount);
        await dbContext.saveData();

        await logger.info({
            message: `Claiming... ${addressData.someResponse.amount} STRK`,
            moduleString: moduleStr
        });

        await new TxConfirmation({
            dbContext,
            logger,
            txPayload: payload,
            account,
            provider,
            transactionData: addressData.claim,
            moduleString: moduleStr
        }).execute();

        if (addressData.claim.status !== 'check_balance') {
            return;
        }

        await BalanceHandler.waitForUpdateBalanceStarkForExactToken({
            address: addressData.info.address,
            logger,
            balanceCash: addressData.claim.balanceCash,
            tokenName: 'STRK',
            moduleString: moduleStr,
            provider: provider
        });

        addressData.claim.status = 'done';
        await dbContext.saveData();
    } catch (e) {
        await logger.error({
            message: `Error processing claim for address ${addressData.info.address}:`,
            error: e,
            moduleString: moduleStr
        });
        addressData.claim.status = 'error';
        await dbContext.saveData();
    }
}