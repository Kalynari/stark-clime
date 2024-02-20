import { Answer, InquirerType } from './types';
import { MainMenuValues, menuMapping } from './contstants';
import inquirer from 'inquirer';
import { createDb } from '../lowdb/createDb';
import ClaimerProcessor from '../core/claimer';
import DbContext from '../lowdb/DbContext';
import Logger from '../other/logger';
import { createExcelTable } from '../other/createExcelTable';


export default class InquiryManager {
    private currentAction: string | null = null;
    private readonly dbContext: DbContext;
    private readonly logger: Logger;

    constructor (dbContext: DbContext, logger: Logger ) {
        this.dbContext = dbContext;
        this.logger = logger;
    };

    /**
     * @returns {Promise<any>}
     * @description Show the main menu
     * @param inqType
     */
    public async showMenu (inqType: InquirerType): Promise<any> {
        const answer: Answer = await this.promtHelper(inqType);
        this.currentAction = answer.action;
        await this.handleAction();
    };

    /**
     * @returns {Promise<Answer>}
     * @description Helper function for inquirer
     * @param menuType
     * @param message
     * @private
     */
    private async promtHelper<T extends InquirerType> (
        menuType: T,
        message: string = 'Hello! Choose action:'
    ): Promise<Answer> {
        const { values, texts } = menuMapping[menuType];

        const choices = Object.entries(texts).map(([key, name]) => ({
            name,
            value: values[key],
        }));

        return inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message,
                choices,
            },
        ]);
    };

    /**
     * @returns {Promise<void>}
     * @description Handle the action from the main menu
     * @private
     */
    private async handleAction (): Promise<void> {

        switch (this.currentAction) {
            case MainMenuValues.CREATE_DB:
                await createDb(this.dbContext, this.logger);
                break;
            case MainMenuValues.RUN_CLAIMER:
                const claimer: ClaimerProcessor = new ClaimerProcessor(this.dbContext, this.logger);
                await claimer.initialize();
                await claimer.process();
                break;
            case MainMenuValues.CREATE_EXCEL_TABLE:
                await createExcelTable(this.dbContext, this.logger);
                break;
            case MainMenuValues.EXIT:
                process.exit(0);

        }

        await this.showMenu('mainMenu');
    };
}