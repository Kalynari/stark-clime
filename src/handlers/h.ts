import { Block, ethers } from 'ethers';
import { General } from '../../config';
import Logger from '../other/logger';

class Helper {

    static trimString (input: string, sliceNumber: number): string {
        if (input.length > 10) {
            return `${input.slice(0, sliceNumber)}...${input.slice(-sliceNumber)}`;
        } else {
            return input;
        }
    };

    static delay (ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    };

    static async waitForGasEVM (logger: Logger, moduleString: string): Promise<boolean> {
        try {
            const provider = new ethers.JsonRpcProvider(General.ERC20);

            while (true) {
                const block: Block | null = await provider.getBlock('latest');

                if (!block) {
                    await h.delay(1000);
                    continue;
                }

                const baseFeePerGas: bigint | null = block.baseFeePerGas;

                if (!baseFeePerGas) {
                    await h.delay(1000);
                    continue;
                }

                const current_gas = parseFloat(ethers.formatUnits(baseFeePerGas, 'gwei'));

                if (current_gas >= General.maxGas) {
                    await logger.info({
                        message: `Gas is still high | Current ${current_gas} GWEI | Need ${General.maxGas} GWEI `,
                        moduleString: moduleString
                    });
                    await h.delay(10000);
                } else {
                    await logger.info({
                        message: `Gas is within normal limits | Current ${current_gas} GWEI | Need ${General.maxGas} GWEI `,
                        moduleString: moduleString
                    });
                    return true;
                }
            }
        } catch (e) {
            throw new Error(e);
        }
    };

    static formatNumber (number: number, decimalPlaces: number): number {
        if (number < 1 / Math.pow(10, decimalPlaces) && number !== 0) {
            return number;
        }

        const roundedNumber =
            Math.round(number * Math.pow(10, decimalPlaces)) /
            Math.pow(10, decimalPlaces);
        if (Math.floor(roundedNumber) === roundedNumber) {
            return roundedNumber;
        } else {
            return +roundedNumber.toFixed(decimalPlaces);
        }
    };
}


const h = Helper;

export default h;