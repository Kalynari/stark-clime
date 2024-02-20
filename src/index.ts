import InquiryManager from './inquirer/inquiryManager';
import Logger from './other/logger';
import DbService from './lowdb/DbServise';
import DbContext from './lowdb/DbContext';

export async function main (): Promise<void> {

    await new Promise(resolve => setTimeout(resolve, 200));

    // Создание глобального логгера
    const logger: Logger = new Logger({
        includeDate: true,
        customMsg: '[STRK-claimer]',
        filePath: './claimer.txt'
    });

    // Подключение к бд
    const db: DbService = new DbService();
    await db.connect();
    const dbContext: DbContext = new DbContext(db);

    await new InquiryManager(dbContext, logger).showMenu('mainMenu');
}

await main();