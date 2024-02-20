import { EligibleWallet } from '../other/types';
import afs from 'node:fs/promises';
import path from 'node:path';

export class FileHandler {

    public static async readFile (filePath: string): Promise<string> {
        try {
            await afs.access(filePath);
        } catch {
            throw new Error(`File doesn't exist: ${filePath}`);
        }
        return afs.readFile(filePath, 'utf-8');
    };

    public static async loadFile (filePath: string): Promise<string[]> {
        filePath = path.join(process.cwd(), filePath);

        const data: string = await this.readFile(filePath);
        return data.split('\n')
            .map(line => line.replace(/\r/g, '').trim())
            .filter(line => line !== '');
    };

    public static async loadJson (filePath: string): Promise<EligibleWallet[]> {
        filePath = path.join(process.cwd(), filePath);

        const data = await FileHandler.readFile(filePath);
        return JSON.parse(data).eligibles.map((el: { identity: string, amount: number, merkle_index: number, merkle_path: string[] }): EligibleWallet => ({
            identity: el.identity,
            amount: el.amount,
            merkle_index: el.merkle_index,
            merkle_path: el.merkle_path
        }));
    };

    public static async writeFile (filePath: string, new_data: string, rewrite?: boolean, separator?: string): Promise<void> {
        try {
            if (rewrite) {
                await afs.writeFile(filePath, new_data);
            } else {
                let existingData = '';
                try {
                    existingData = await this.readFile(filePath);
                } catch {
                    /* do nothing */
                }

                const updatedData = existingData + '\n' + separator + '\n' + new_data;

                await afs.writeFile(filePath, updatedData);
            }
        } catch (e) {
            throw Error(`Произошла ошибка при записи в файл ${filePath}: ${e}`);
        }
    };
}