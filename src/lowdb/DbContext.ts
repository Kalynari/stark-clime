import DbService from './DbServise';
import { DbSchema } from './createDb';

export default class DbContext {
    public db: DbService | null;

    constructor (database: DbService) {
        this.db = database;
        if (!this.db) {
            throw new Error('Database connection is not established');
        }
    };

    public async getAllAddresses (): Promise<DbSchema | undefined> {
        return this.db?.getData();
    };

    public async saveData (): Promise<void> {
        return this.db?.writeDb();
    };

    public async readData (): Promise<void> {
        return this.db?.connect();
    };
}