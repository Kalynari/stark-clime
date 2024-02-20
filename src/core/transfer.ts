import DbContext from '../lowdb/DbContext';
import Logger from '../other/logger';
import { AddressData, SwapOnDexData, TransferData } from '../lowdb/types';
import { Account, AllowArray, Call, RpcProvider } from 'starknet';
import { General } from '../../config';
import BalanceHandler from '../handlers/balanceHandler';
import h from '../handlers/h';
import TxConfirmation from '../other/txConfirmation';
import { Retryable } from 'typescript-retry-decorator';
import Payloads from './payloads';

export default class TransferProcessor {
    dbContext: DbContext;
    logger: Logger;
    addressData: AddressData;
    transferDataETH: TransferData;
    transferDataSTRK: TransferData;
    provider: RpcProvider;
    account: Account;
    moduleString: string;

    constructor (dbContext: DbContext, logger: Logger, addressData: AddressData, moduleString: string) {
        this.dbContext = dbContext;
        this.logger = logger;
        this.addressData = addressData;
        this.transferDataETH = addressData.transferETH;
        this.transferDataSTRK = addressData.transferSTRK;
        this.provider = new RpcProvider({ nodeUrl: General.rpc[0] });
        this.account = new Account(this.provider, addressData.info.address, addressData.info.privateKey, '1');
        this.moduleString = moduleString;
    };

    public async transferETH (): Promise<void> {

        await this.transferToken('ETH');
    };

    public async transferSTRK (state: SwapOnDexData): Promise<void> {

        if (state.status === 'done') {
            return;
        }

        await this.transferToken('STRK');
    };

    @Retryable({
        maxAttempts: General.maxRetry,
        backOff: 5000
    })
    public async transferToken (tokenType: 'ETH' | 'STRK'): Promise<void> {
        let transferData: TransferData = tokenType === 'ETH' ? this.transferDataETH : this.transferDataSTRK;

        try {

            if (transferData.status === 'done' || transferData.status === 'skip') {
                return;
            }

            if (!General[`shouldWithdraw${tokenType}`]) {
                await this.logger.info({
                    message: `Withdraw ${tokenType} is disabled.`,
                    moduleString: `${this.moduleString}[transfer]`
                });
                transferData.status = 'done';
                await this.dbContext.saveData();
                return;
            }

            let amountToSend: bigint = await BalanceHandler.balanceCheckerForToken(tokenType, this.addressData.info.address);
            let txPayload: AllowArray<Call> = await Payloads.getPayload(this.account, transferData.toAddress, amountToSend, tokenType);


            transferData.balanceCash = Number(await BalanceHandler.balanceCheckerForToken(transferData.token, transferData.toAddress));
            transferData.amount = Number(amountToSend) / 10 ** 18;
            this.addressData.info[`amount${tokenType}`] = Number(amountToSend) / 10 ** 18;
            await this.dbContext.saveData();


            await this.logger.info({
                message: `Sending ${transferData.amount} ${tokenType} to ${h.trimString(transferData.toAddress, 5)}`,
                moduleString: `${this.moduleString}[transfer${tokenType}]`
            });

            await new TxConfirmation({
                dbContext: this.dbContext,
                logger: this.logger,
                txPayload,
                account: this.account,
                provider: this.provider,
                transactionData: transferData,
                moduleString: `${this.moduleString}[transfer${tokenType}]`
            }).executeWithRetry();

            if (transferData.status !== 'check_balance') {
                return;
            }

            await BalanceHandler.waitForUpdateBalanceStarkForExactToken({
                address: transferData.toAddress,
                logger: this.logger,
                balanceCash: transferData.balanceCash,
                moduleString: `${this.moduleString}[balanceCash${tokenType}]`,
                tokenName: tokenType,
                provider: this.provider
            });

            transferData.status = 'done';
            await this.dbContext.saveData();

        } catch (error) {
            await this.logger.error({
                message: `Error processing transfer ${tokenType} to ${h.trimString(transferData.toAddress, 5)}:`,
                error: error,
                moduleString: `${this.moduleString}[transfer${tokenType}]`,
            });
            transferData.status = 'error';
            await this.dbContext.saveData();
            throw error;
        }
    };
}
