import { GenericKeys, InquirerType, MainMenuKeys } from './types';

export const MainMenuTexts: GenericKeys<MainMenuKeys> = {
    CREATE_DB: '1. Create Database',
    RUN_CLAIMER: '2. Run Claimer',
    CREATE_EXCEL_TABLE: '3. Create Excel Table',
    EXIT: '4. Exit'
};

export const MainMenuValues: GenericKeys<MainMenuKeys> = {
    CREATE_DB: 'create_db',
    RUN_CLAIMER: 'run_claimer',
    CREATE_EXCEL_TABLE: 'create_excel_table',
    EXIT: 'exit'
};

export const menuMapping: Record<InquirerType, {values: GenericKeys<string>, texts: GenericKeys<string>}> = {
    mainMenu: {
        values: MainMenuValues,
        texts: MainMenuTexts
    }
};