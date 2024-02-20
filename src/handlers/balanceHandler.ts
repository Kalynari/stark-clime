import { addAddressPadding, Contract, num, Provider } from 'starknet';
import { BalanceCashVars } from '../other/types';
import h from './h';
import { chainContract } from '../other/constants';
import { General } from '../../config';


export default class BalanceHandler {

    public static async getAmountTokenStark (
        walletAddress: string,
        tokenAddress: string,
        abiAddress: string,
        provider: Provider
    ): Promise<bigint> {
        try {
            if (!abiAddress) {
                abiAddress = tokenAddress;
            }

            const { abi: abi } = await provider.getClassAt(abiAddress);
            if (abi === undefined) {
                throw new Error('no abi.');
            }

            const contract: Contract = new Contract(abi, addAddressPadding(tokenAddress), provider);

            return await contract.functions.balanceOf(walletAddress);
        } catch (e) {
            throw Error(e);
        }
    };

    static async balanceCheckerForToken (
        tokenName: keyof typeof chainContract,
        address: string,
    ): Promise<bigint | undefined> {

        const maxRetries = General.rpc.length;
        let currentAttempt = 0;

        while (currentAttempt < maxRetries) {
            try {
                const provider = new Provider({ nodeUrl: General.rpc[currentAttempt] });
                const balance = await this.getAmountTokenStark(address, chainContract[tokenName], chainContract.ERC20ABI, provider)
                return balance.balance.low;
            } catch (e) {
                currentAttempt++;

                if (currentAttempt >= maxRetries) {
                    throw Error('First attempt for all RPC failed, we will try another attempt');
                }
            }
        }
    };

    static async waitForUpdateBalanceStarkForExactToken (vars: BalanceCashVars): Promise<void> {
        try {
            let attempts = 15;
            while (attempts > 0) {
                let balanceNew = await this.balanceCheckerForToken(vars.tokenName, vars.address);

                if (!balanceNew) {
                    throw 'balanceNew if undefined';
                }

                if (num.toBigInt(balanceNew) >= num.toBigInt(vars.balanceCash)) {
                    await vars.logger.info({
                        message: 'Deposit confirmed on wallet, updating balance...',
                        moduleString: vars.moduleString
                    });
                    return;
                }
                else {
                    await vars.logger.info({
                        message: 'Deposit not confirmed on wallet yet, waiting 10sec...',
                        moduleString: vars.moduleString
                    });

                    await h.delay(10000);
                    attempts--;
                }
            }
        } catch (e) {
            throw Error(e);
        }
    };
};