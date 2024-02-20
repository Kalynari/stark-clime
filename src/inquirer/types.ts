export type InquirerType = 'mainMenu'

export type MainMenuKeys = 'CREATE_DB' | 'RUN_CLAIMER' | 'CREATE_EXCEL_TABLE' |'EXIT'

export type GenericKeys<T extends string> = {
    // eslint-disable-next-line no-unused-vars
    [key in T]: string;
};

export interface Answer {
    action: string;
}





