import Logger from './logger';
import { Account, AllowArray, BigNumberish, Call, Provider } from 'starknet';
import { chainContract } from './constants';
import { TransferData } from '../lowdb/types';
import DbContext from '../lowdb/DbContext';


export type BalanceCashVars = {
    address: string,
    logger: Logger,
    balanceCash: BigNumberish,
    moduleString: string,
    tokenName: keyof typeof chainContract,
    provider: Provider,
};

export type TxConfirmationVars = {
    dbContext: DbContext,
    logger: Logger,
    txPayload: AllowArray<Call>,
    account: Account,
    provider: Provider,
    transactionData: TransferData,
    moduleString: string,
};

export type EligibleWallet = {
    identity: string,
    amount: string,
    merkle_index: string,
    merkle_path: string[],
};

export type Wallet = {
    mnemonic: string | null;
    privateKey: string;
    address: string | null;
    ETHAddress: string;
    STRKAddress: string;
    eligible: boolean;
    data: EligibleWallet
};

