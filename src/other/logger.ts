import { promises as fs } from 'fs';

interface ILoggerOptions {
    customMsg?: string;
    filePath?: string;
    includeDate?: boolean;
}

export type LogInfo = {
    message: any;
    moduleString?: string;
};

export type ErrorInfo = {
    message: string;
    error?: any
    moduleString?: string;
};


class Logger {
    private readonly customMsg: string | undefined;
    private readonly filePath: string | undefined;
    private readonly includeDate: boolean | undefined;

    constructor (opts: ILoggerOptions) {
        this.customMsg = opts.customMsg;
        this.filePath = opts.filePath;
        this.includeDate = opts.includeDate;
    };

    private formatDate (): string {
        const now = new Date();
        return `[${now.toISOString().replace('T', ' ').replace('Z', '')}]`;
    };

    private stripAnsi (str: string, level: 'info' | 'error' | 'success' = 'info'): string {
        if (level === 'error') {
            return str;
        }
        // eslint-disable-next-line no-control-regex
        return str.replace(/\x1b\[[0-9;]*m/g, '');
    };

    private async logToFile (message: string, level: 'info' | 'error' | 'success' = 'info'): Promise<void> {
        if (this.filePath) {
            const messageWithoutAnsi = this.stripAnsi(message, level) + '\n';
            let fileHandle = null;
            try {
                fileHandle = await fs.open(this.filePath, 'a');
                await fileHandle.writeFile(messageWithoutAnsi);
            } catch (error) {
                console.log(error);
            } finally {
                if (fileHandle) {
                    await fileHandle.close();
                }
            }
        }
    };

    private green (text: string): string {
        return `\x1b[32m${text}\x1b[0m`;
    };

    private red (text: string): string {
        return `\x1b[31m${text}\x1b[0m`;
    };

    public async info (vars: LogInfo): Promise<void> {
        await this.log(vars.message, 'info', vars.moduleString);
    };

    public async error (vars: ErrorInfo): Promise<void> {
        let coloredMessage:string = this.red(vars.message);
        await this.log(coloredMessage, 'error', vars.moduleString, vars.error);
    };

    public async success (vars: LogInfo): Promise<void> {
        const coloredMessage = this.green(typeof vars.message === 'string' ? vars.message : this.serializeData(vars.message));
        await this.log(coloredMessage, 'success', vars.moduleString);
    };

    private async log (message: any, level: 'info' | 'error' | 'success' = 'info', customMessage: string = '', error: any = ''): Promise<void> {

        const datePrefix = this.includeDate ? this.formatDate() : '';
        const levelColor = level === 'error' ? this.red(level) : level === 'success' ? this.green(level) : level;

        const parts = [
            datePrefix,
            this.customMsg ? this.customMsg : '',
            customMessage ? customMessage : '',
            `[${levelColor}]: - `
        ];

        let finalMessage = parts.filter(part => part !== '').join('');
        finalMessage = finalMessage + message + error;
        console.log(finalMessage);
        await this.logToFile(finalMessage, level);
    };

    private serializeData (data: any): string {
        try {
            return JSON.stringify(data, null, 2);
        } catch (error) {
            return `Non-serializable data: ${error.message}`;
        }
    }
}

export default Logger;
