import { ethers, HDNodeWallet } from 'ethers';
import { addAddressPadding, Calldata, CallData, ec, hash, RawArgs } from 'starknet';
import {
    argentAccountClassHashCairo0,
    argentAccountClassHashCairo1,
    argentProxyClassHash,
    starknetDerivePath
} from '../other/constants';
import { General } from '../../config';
import StarknetClient from '../clients/starknetClient';
import h from './h';

export default class WalletHandler {

    static getPrivateKeyFromMnemonicArgent = async (starknetMnemonic: string): Promise<string> => {
        try {
            const signer: string = (ethers.Wallet.fromPhrase(starknetMnemonic)).privateKey;
            const masterNode: HDNodeWallet = HDNodeWallet.fromSeed(this.#toHexString(signer));
            const childNode: HDNodeWallet = masterNode.derivePath(starknetDerivePath);

            return '0x' + ec.starkCurve.grindKey(childNode.privateKey).toString();
        } catch (e) {
            throw Error(e);
        }
    };

    static isPrivateKey (privateData: string): boolean {
        return privateData.includes('0x');
    };

    static async getPrivateKeyFromMnemonicArgentBroken (starknetMnemonic: string): Promise<string> {
        try {
            const signer: string = (ethers.Wallet.fromPhrase(starknetMnemonic)).privateKey;
            const masterNode: HDNodeWallet = HDNodeWallet.fromSeed(signer);
            const childNode: HDNodeWallet = masterNode.derivePath(starknetDerivePath);

            return '0x' + ec.starkCurve.grindKey(childNode.privateKey).toString();
        } catch (e) {
            throw Error(e);
        }
    };

    static async getAddressArgentCairo0 (starknetPrivateKey: string): Promise<string> {
        try {
            const publicKey: string = ec.starkCurve.getStarkKey(starknetPrivateKey);

            const ConstructorCallData: RawArgs = CallData.compile({
                implementation: argentAccountClassHashCairo0,
                selector: hash.getSelectorFromName('initialize'),
                calldata: CallData.compile({ signer: publicKey, guardian: '0' }),
            });

            return hash.calculateContractAddressFromHash(
                publicKey,
                argentProxyClassHash,
                ConstructorCallData,
                0
            );
        } catch (e) {
            throw Error(e);
        }
    };

    static async getAddressArgentCairo1 (starknetPrivateKey: string): Promise<string> {
        try {
            const publicKey: string = ec.starkCurve.getStarkKey(starknetPrivateKey);

            const constructorCalldata: Calldata = CallData.compile({
                owner: publicKey,
                guardian: 0n
            });

            return hash.calculateContractAddressFromHash(
                publicKey,
                argentAccountClassHashCairo1,
                constructorCalldata,
                0
            );
        } catch (e) {
            throw Error(e);
        }
    };

    public static async checkVersions (addresses: string[]): Promise<string[]> {
        return await StarknetClient.getClassHashesAt(
            addresses,
            General.rpc[0]
        );
    };

    public static async getAddressesFromPrivateKeysArgent (privateKeys: string[]): Promise<(string|null)[]> {
        let addresses = await Promise.all(privateKeys.map(privateKey => this.getAddressArgentCairo0(privateKey)));

        let classHashes = await this.checkVersions(addresses);

        for (let i = 0; i < addresses.length; i++) {
            if (!classHashes[i]) {
                addresses[i] = await this.getAddressArgentCairo1(privateKeys[i]);
            }
        }

        await h.delay(1000);
        classHashes = await this.checkVersions(addresses);

        return addresses.map((address, index): string | null => classHashes[index] ? addAddressPadding(address) : null);
    };

    static #toHexString (value: string): string {
        let hex = BigInt(value).toString(16);
        if (hex.length % 2 !== 0) {
            hex = '0' + hex;
        }

        return '0x' + hex;
    };
}