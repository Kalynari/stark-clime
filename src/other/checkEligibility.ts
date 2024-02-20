import { FileHandler } from '../handlers/fileHandler';
import WalletHandler from '../handlers/walletHandler';
import { General } from '../../config';
import { ADDRESSES_TO_WITHDRAW_ETH, ADDRESSES_TO_WITHDRAW_STRK, STARKNET_DATA } from './constants';
import { EligibleWallet, Wallet } from './types';
import Logger from './logger';

export default class Eligibility {
    public static async checkEligibility (logger: Logger): Promise<Wallet[] | null> {
        const combinedEligibleWallets: EligibleWallet[] = await this.loadEligibleWallets();

        const [ethAddresses, strkAddresses] = await this.loadAddresses();

        const allPrivateData = await FileHandler.loadFile(STARKNET_DATA);

        if (allPrivateData.length !== strkAddresses.length && General.shouldWithdrawSTRK) {
            await logger.error({
                message: 'The length of the starknetData and addressesToWithdrawSTRK must be the same.',
            });

            return null;
        }

        if (General.shouldWithdrawETH && allPrivateData.length !== ethAddresses.length) {
            await logger.error({
                message: 'The length of the starknetData, addressesToWithdrawETH must be the same.',
            });

            return null;
        }

        const privateKeysPromises = allPrivateData.map(data => {
            if (WalletHandler.isPrivateKey(data)) {
                return Promise.resolve(data);
            } else {
                return General.brokenMnemo
                    ? WalletHandler.getPrivateKeyFromMnemonicArgentBroken(data)
                    : WalletHandler.getPrivateKeyFromMnemonicArgent(data);
            }
        });

        const privateKeys = await Promise.all(privateKeysPromises);

        const chunkArray = (arr: string | any[], size: number): any =>
            arr.length > size ? [arr.slice(0, size), ...chunkArray(arr.slice(size), size)] : [arr];

        const privateKeysChunks = chunkArray(privateKeys, 40);

        let addressesChunks: Array<string | null> = [];

        for (const chunk of privateKeysChunks) {
            const addressesChunk = await WalletHandler.getAddressesFromPrivateKeysArgent(chunk);
            addressesChunks = addressesChunks.concat(addressesChunk);
        }

        return addressesChunks.map((address, index) => {
            const wallet = combinedEligibleWallets.find(wallet => wallet.identity === address);
            const isEligible = Boolean(wallet);
            return {
                mnemonic: WalletHandler.isPrivateKey(allPrivateData[index]) ? null : allPrivateData[index],
                privateKey: privateKeys[index],
                address,
                ETHAddress: ethAddresses[index],
                STRKAddress: strkAddresses[index],
                eligible: isEligible,
                data: {
                    amount: wallet?.amount,
                    merkle_index: wallet?.merkle_index,
                    merkle_path: wallet?.merkle_path,
                    identity: address
                }
            };
        });
    };

    private static async loadEligibleWallets (): Promise<EligibleWallet[]> {
        const eligibleFiles = [
            'elig/starknet-0.json',
            'elig/starknet-1.json',
            'elig/starknet-2.json',
            'elig/starknet-3.json',
            'elig/starknet-4.json',
            'elig/starknet-5.json',
            'elig/starknet-6.json',
            'elig/starknet-7.json',
            'elig/starknet-8.json',
            'elig/starknet-9.json',
            'elig/starknet-10.json',
        ];

        return (await Promise.all(eligibleFiles.map(FileHandler.loadJson))).flat();
    };

    private static async loadAddresses (): Promise<[string[], string[]]> {
        const ethAddresses = await FileHandler.loadFile(ADDRESSES_TO_WITHDRAW_ETH);
        const strkAddresses = await FileHandler.loadFile(ADDRESSES_TO_WITHDRAW_STRK);
        return [ethAddresses, strkAddresses];
    };
}
