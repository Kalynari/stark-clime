import { Account, AllowArray, Call, Provider } from 'starknet';
import DbContext from '../lowdb/DbContext';
import Logger from './logger';
import { ClaimData, SwapOnDexData, TransferData } from '../lowdb/types';
import { TxConfirmationVars } from './types';
import h from '../handlers/h';
import { explorerTx } from './constants';
import { General } from '../../config';


export default class TxConfirmation {
    dbContext: DbContext;
    logger: Logger;
    txPayload: AllowArray<Call>;
    account: Account;
    provider: Provider;
    transactionData: TransferData | ClaimData | SwapOnDexData;
    moduleString: string;

    constructor (vars: TxConfirmationVars) {
        this.dbContext = vars.dbContext;
        this.logger = vars.logger;
        this.txPayload = vars.txPayload;
        this.account = vars.account;
        this.provider = vars.provider;
        this.transactionData = vars.transactionData;
        this.moduleString = vars.moduleString;
    };

    async execute (): Promise<TransferData | ClaimData | SwapOnDexData | undefined> {
        try {

            if (this.transactionData.status === 'done' || this.transactionData.status === 'skip' || this.transactionData.status === 'check_balance') {
                return;
            }

            // Получаем текущий нонс
            let nonceCache;
            let nonce;
            try {
                nonceCache = await this.account.getNonce();
                nonceCache = parseInt(nonceCache, 16);
            } catch (e) {
                try {
                    nonceCache = await this.account.getNonceForAddress(this.account.address);
                    nonceCache = parseInt(nonceCache, 16);
                } catch (error) {
                    await this.logger.error({
                        message: 'Error while fetching nonce: ',
                        error: error,
                        moduleString: this.moduleString,
                    });
                    throw (`${this.moduleString} - Error while fetching nonce: ${e}`);
                }
            }

            let executeHash;
            // Код ниже отправляет транзакцию, если она еще не отправляема
            if (this.transactionData.status !== 'process') {
                await h.waitForGasEVM(this.logger, this.moduleString);
                while (true) {
                    try {
                        executeHash = await this.account.execute(this.txPayload);
                        // Сохранение необходимых значений в бд, для работы кода, в случае ошибки
                        this.transactionData.status = 'process';
                        this.transactionData.txHash = executeHash.transaction_hash;
                        this.transactionData.nonceCash = nonceCache;
                        await this.dbContext.saveData();
                        await this.logger.info({
                            message: `Transaction hash: ${executeHash.transaction_hash}`,
                            moduleString: this.moduleString,
                        });
                        break;
                    } catch (error) {
                        // Обработка, когда такая транзакция уже существует
                        if (error.message.includes('Transaction with hash')) {
                            await h.delay(10000);
                        } else {
                            await this.logger.error({
                                error: error,
                                message: 'Error while executing transaction ',
                                moduleString: this.moduleString,
                            });
                            break;
                        }
                    }
                }
                await this.logger.info({
                    message: `Send TX: ${explorerTx + executeHash.transaction_hash}`,
                    moduleString: this.moduleString,
                });

                await this.logger.info({
                    message: 'Start waiting for transaction....',
                    moduleString: this.moduleString,
                });
            }

            nonceCache = this.transactionData.nonceCash;

            await this.logger.info({
                message: 'Start checking after save tx....',
                moduleString: this.moduleString,
            });


            let res;
            let flag;
            let reason;

            // Получение статуса транзакции и обработка ошибок
            while (true) {
                try {
                    res = await this.account.getTransactionReceipt(this.transactionData.txHash);
                    // Если транзакция подтверждена
                    if (res.finality_status === 'ACCEPTED_ON_L2' && res.execution_status === 'SUCCEEDED') {
                        flag = 1;
                        break;
                        // Если транзакция отклонена
                    } else if (res.execution_status === 'REVERTED') {
                        reason = res.revert_reason;
                        flag = 0;
                        break;
                    }
                } catch (error) {
                    if (error.message.includes('Transaction hash not found')) {
                        await h.delay(2000);
                    } else {
                        await this.logger.error({
                            message: 'Error while fetching transaction status',
                            error: error,
                            moduleString: `${this.moduleString}[getTransactionStatus]`,
                        });
                    }

                }

                await h.delay(2000);
            }

            // Непосредственная обработка статуса самой транзакции
            // флаг если транзакция подтверждена
            if (flag === 1) {
                nonce = await this.account.getNonce();
                nonce = parseInt(nonce, 16);

                // Проверяем nonce, если он не обновился, то ждем пока он обновится
                if (nonce === nonceCache) {
                    await this.logger.info({
                        message: `Transaction success, but nonce still low | Nonce ${nonce}`,
                        moduleString: this.moduleString,
                    });

                    for (let i = 0; i < 90; i++) {
                        await h.delay(2000);
                        nonce = await this.account.getNonce();
                        nonce = parseInt(nonce, 16);
                        if (nonce > nonceCache) {
                            await this.logger.success({
                                message: `The transaction is fully confirmed in the blockchain | Nonce ${nonce}`,
                                moduleString: this.moduleString,
                            });
                            this.transactionData.status = 'check_balance';
                            await this.dbContext.saveData();
                            return this.transactionData;
                        }
                    }
                } else if (nonce > nonceCache) {
                    await this.logger.success({
                        message: `The transaction is fully confirmed in the blockchain | Nonce ${nonce}`,
                        moduleString: this.moduleString,
                    });
                    this.transactionData.status = 'check_balance';
                    await this.dbContext.saveData();
                    return this.transactionData;
                }
                // флаг если транзакция отклонена
            } else if (flag === 0) {
                this.transactionData.status = 'error';
                await this.logger.error({
                    error: reason,
                    message: 'Transaction failed with reason:',
                    moduleString: this.moduleString,
                });

                throw Error(`${this.moduleString} - Transaction failed with reason: ${reason}`);
            } else {
                await this.logger.error({
                    message: 'An error occurred',
                    moduleString: this.moduleString,
                });
                throw Error(`${this.moduleString} - An error occurred`);
            }

        } catch (error) {
            await this.logger.error({
                message: 'An error occurred txPayload error: ',
                error: error,
                moduleString: this.moduleString,
            });
            throw Error(`${this.moduleString} - An error occurred txPayload error: ${error}`);
        }
    };

    async executeWithRetry (): Promise<TransferData | ClaimData | SwapOnDexData | undefined> {
        const maxRetries = General.rpc.length;
        let currentAttempt = 0;

        while (currentAttempt < maxRetries) {
            try {
                this.provider = new Provider({ nodeUrl: General.rpc[currentAttempt] });
                return await this.execute();
            } catch (error) {
                await this.logger.error({
                    message: `Attempt ${currentAttempt + 1} failed with RPC ${General.rpc[currentAttempt]}:`,
                    moduleString: '[executeWithRetry]',
                    error: error,
                });
                currentAttempt++;

                if (currentAttempt >= maxRetries) {
                    await this.logger.error({
                        message: 'First attempt for all RPC failed, we will try another attempt',
                        moduleString: '[executeWithRetry]'
                    });
                    throw new Error('First attempt for all RPC failed, we will try another attempt');
                }
            }
        }
    }
};