import { AllowArray, Call } from 'starknet';

export type Status = 'default' | 'done' | 'process' | 'error' | 'skip' | 'check_balance' | 'get_payload'
export type Dex = 'AVNU' | 'Fibrous' | 'Ekubo' | 'JediSwap' | 'MySwap' | 'default'

export type AddressInfo = {
    address: string;
    privateKey: string;
    mnemonic: string | null;
    addressToWithdrawETH: string;
    addressToWithdrawSTRK: string;
    amountSTRK: number;
    amountETH: number;
    eligible: boolean;
    status: Status;
};

export type TransferData = {
    fromAddress: string;
    toAddress: string;
    token: 'ETH' | 'STRK';
    amount: number;
    status: Status;
    balanceCash: number;
    txHash: string;
    nonceCash: number;
};

export type ClaimData = {
    amount: number;
    status: Status;
    balanceCash: number;
    txHash: string;
    nonceCash: number;
};

export type SwapOnDexData = {
    state: boolean,
    txHash: string;
    status: Status;
    priceSTRK: number,
    amountETH: number,
    nonceCash: number;
    dex: Dex;
    balanceCash: number;
    payload: AllowArray<Call> | undefined;
}

export type AddressData = {
    info: AddressInfo;
    someResponse: Resp;
    swapOnDex: SwapOnDexData,
    transferETH: TransferData;
    transferSTRK: TransferData;
    claim: ClaimData;
};

type Resp = {
    eligible: boolean,
    amount: string,
    merkle_index: string,
    merkle_path: string[]
};

export type RpcStatus = {
    rpc: string;
    status: 'ok' | 'error';
};