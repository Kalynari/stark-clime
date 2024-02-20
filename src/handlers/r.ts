import { General } from '../../config';

class Randomizer {

    static int (min: number, max: number): number {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    static float (min: number, max: number, rounder?: number): number {

        if (!rounder) {
            return Math.random() * (max - min) + min;
        }
        return this.round(Math.random() * (max - min) + min, rounder);
    };

    static round (number: number, dec: number): number {
        let numStr = number.toString();
        if (numStr.includes('e')) {
            numStr = Number(number).toFixed(dec + 1);
        }
        const [whole, fraction = ''] = numStr.split('.');
        const truncatedFraction = (fraction + '00000000').slice(0, dec);
        return parseFloat(whole + '.' + truncatedFraction);
    };

    static delay (): number {
        return this.int(General.delay[0], General.delay[1]);
    };

    static keepBalance (): number {
        return this.float(General.keepBalanceETH[0], General.keepBalanceETH[1], 2) * 10 ** 18;
    };
}

const r = Randomizer;
export default r;
