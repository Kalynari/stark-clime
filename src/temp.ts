import { cairo, CallData, Contract, num, Provider } from 'starknet';
import { abiMySwap } from './other/abi';
import { chainContract } from './other/constants';
import { General } from '../config';
import BalanceHandler from './handlers/balanceHandler';
import Logger from './other/logger';


async function processMySwap () {
    const provider = new Provider({ nodeUrl: General.rpc[0] });

    const logger: Logger = new Logger({
        includeDate: true,
        customMsg: '[STRK-claimer]',
        filePath: './claimer.txt'
    });

    await BalanceHandler.waitForUpdateBalanceStarkForExactToken({
        address: '0x0255f231140d229b1c648d3deafcbabbfdbf851578ca8a88b269a0fb87f100b9',
        balanceCash: 0,
        logger: logger,
        moduleString: 'asdfasdf',
        provider: provider,
        tokenName: 'STRK'
    });
}





await processMySwap();