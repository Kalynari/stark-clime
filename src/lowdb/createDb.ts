import { AddressData } from './types';
import Logger from '../other/logger';
import DbContext from './DbContext';
import { Low } from 'lowdb';
import Eligibility from '../other/checkEligibility';
import { Wallet } from '../other/types';
import { General } from '../../config';

export type DbSchema = {
    [address: string]: AddressData
}
export async function createDb (dbContext: DbContext, logger: Logger): Promise<void> {

    await dbContext.readData();

    const db = <Low<DbSchema>> dbContext.db?.getDb();
    // if (db.data !== Object({})) {
    //     await logger.info({
    //         message: 'Database is already created',
    //     });
    //     return;
    // }

    // Для каждого кошелька вернется тип Wallet
    const walletData: Wallet[] | null = await Eligibility.checkEligibility(logger);
    if (!walletData) {
        return;
    }

    if (General.shuffleWallets) {
        await logger.info({
            message: 'Shuffling wallets',
        });
        walletData.sort(() => Math.random() - 0.5);
    }

    // Цикл по всем кошелькам, который создает записи в базе данных
    for (let i = 0; i < walletData.length; i++) {
        const data: Wallet = walletData[i];

        const address: string | null = data.address;

        if (!address) {
            await logger.info({
                message: `Address: ${address} is null`,
            });
            continue;
        }

        db.data[address] = {
            someResponse: {
                merkle_index: data.data.merkle_index,
                merkle_path: data.data.merkle_path,
                amount: data.data.amount,
                eligible: data.eligible,
            },
            swapOnDex: {
                amountETH: 0,
                nonceCash: 0,
                priceSTRK: 0,
                state: false,
                status: 'default',
                txHash: '',
                dex: 'default',
                balanceCash: 0,
                payload: undefined,
            },
            info: {
                address: address,
                privateKey: data.privateKey,
                mnemonic: data.mnemonic,
                addressToWithdrawETH: data.ETHAddress,
                addressToWithdrawSTRK: data.STRKAddress,
                amountSTRK: 0,
                amountETH: 0,
                eligible: data.eligible,
                status: 'default'
            },
            transferETH: {
                fromAddress: address,
                toAddress: data.ETHAddress,
                amount: 0,
                status: General.shouldWithdrawETH ? 'default' : 'skip',
                balanceCash: 0,
                txHash: '',
                token: 'ETH',
                nonceCash: 0
            },
            transferSTRK: {
                fromAddress: address,
                toAddress: data.STRKAddress,
                amount: 0,
                status: General.shouldWithdrawSTRK ? 'default' : 'skip',
                balanceCash: 0,
                txHash: '',
                token: 'STRK',
                nonceCash: 0
            },
            claim: {
                amount: 0,
                txHash: '',
                balanceCash: 0,
                nonceCash: 0,
                status: 'default'
            }
        };

        await logger.info({
            message: `Database created for address: ${address}`,
        });
    }

    await dbContext.saveData();
    await logger.info({
        message: 'Database created successfully',
    });
}