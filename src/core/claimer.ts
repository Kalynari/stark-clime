import Logger from '../other/logger';
import DbContext from '../lowdb/DbContext';
import { DbSchema } from '../lowdb/createDb';
import TransferProcessor from './transfer';
import h from '../handlers/h';
import { AddressData } from '../lowdb/types';
import { General } from '../../config';
import { FileHandler } from '../handlers/fileHandler';
import { ERROR_PRIVATE_KEYS } from '../other/constants';
import { Retryable } from 'typescript-retry-decorator/dist/retry.decorator';
import { getStringToSend, sendSingleMessageToChats } from '../other/tgBotClient';
import r from '../handlers/r';
import ProcessAutoSell from './autoSellOnDex';
import { processClaim } from './processClaim';


// Основная функцция, для клейма
export default class ClaimerProcessor {
    dbContext: DbContext;
    logger: Logger;
    entries!: [string, AddressData][];
    index: number;


    constructor (dbContext: DbContext, logger: Logger) {
        this.dbContext = dbContext;
        this.logger = logger;
        this.index = 0;
    };

    public async initialize (): Promise<void> {
        const data: DbSchema | undefined = await this.dbContext.getAllAddresses();

        if (!data) {
            await this.logger.error({
                message: 'No data in the db.',
                moduleString: '[core]',
            });
            return;
        }

        this.entries = Object.entries(data);
        if (!this.entries) {
            await this.logger.info({
                message: 'No addresses to process.',
                moduleString: '[core]',
            });
            throw Error('No addresses to process.');
        }
    };

    @Retryable({
        maxAttempts: General.maxRetry,
        backOff: 5000
    })
    public async process (): Promise<void> {

        if (!this.entries) {
            throw Error('No addresses to process.');
        }

        this.entries.sort((a: [string, AddressData], b: [string, AddressData]) => {
            const eligibleA: boolean = a[1].info.eligible;
            const eligibleB: boolean = b[1].info.eligible;
            return eligibleB === eligibleA ? 0 : eligibleA ? -1 : 1;
        });

        for (const [address, addressData] of this.entries) {

            this.index++;
            let moduleStr: string = `[Address ${this.index}/${this.entries.length}][${h.trimString(address, 5)}]`;
            await this.logger.info({
                message: `Processing address: ${address}`,
                moduleString: moduleStr
            });

            const tokenTransfer: TransferProcessor = new TransferProcessor(this.dbContext, this.logger, addressData, moduleStr);

            try {
                // Проверка на то, что адрес уже обработан
                const shouldContinue = await this.processAddressConditionally(addressData, moduleStr, tokenTransfer);
                if (shouldContinue) {
                    continue;
                }

                // TODO закончить клейм
                await processClaim(this.dbContext, this.logger, addressData, moduleStr);

                // автослив токенов
                const autoSell: ProcessAutoSell = new ProcessAutoSell(this.dbContext, this.logger, addressData, moduleStr);
                await autoSell.initialize();
                await autoSell.processAutoSell();

                // два трансфера
                await tokenTransfer.transferSTRK(addressData.swapOnDex);
                await tokenTransfer.transferETH();

                addressData.info.status = 'done';
                await this.dbContext.saveData();

                await this.finalLogs(addressData, moduleStr, address);
            } catch (error) {
                await this.logger.error({
                    message: `Error processing address ${address}`,
                    error: error,
                    moduleString: moduleStr,
                });

                await FileHandler.writeFile(ERROR_PRIVATE_KEYS, addressData.info.privateKey, false);

                addressData.info.status = 'error';
                await this.dbContext.saveData();
            }
        }
    };

    private async processAddressConditionally (
        addressData: AddressData,
        moduleStr: string,
        tokenTransfer: TransferProcessor
    ): Promise<boolean> {

        // Если статус адреса "done", то пропускаем обработку
        if (addressData.info.status === 'done') {
            await this.logger.info({
                message: 'Address already claimed.',
                moduleString: moduleStr
            });
            return true;
        }

        // Иначе устанавливаем статус "process" и продолжаем обработку
        addressData.info.status = 'process';
        await this.dbContext.saveData();

        // Проверяем элигибл кош или нет
        // Если нет, то просто делаем трансфер етх
        if (!addressData.info.eligible) {
            await this.logger.info({
                message: 'Address is not eligible for claiming, start transfer ETH.',
                moduleString: moduleStr
            });

            await tokenTransfer.transferETH();
            await this.finalLogs(addressData, moduleStr, addressData.info.address);
            return true;
        }

        return false;
    };

    private async finalLogs (addressData: AddressData, moduleStr: string, address: string): Promise<void> {
        const logsMsg: string = getStringToSend(addressData, `[Address ${this.index}/${this.entries.length}]: ${h.trimString(address, 5)}`);
        await sendSingleMessageToChats(logsMsg, this.logger);

        const sec: number = r.delay();
        await this.logger.info({
            message: `Address ${h.trimString(address, 5)} processed successfully. Waiting ${sec}sec for the next address.`,
            moduleString: moduleStr
        });
        await h.delay(sec * 1000);
    };
}
