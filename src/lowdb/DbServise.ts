import { DbSchema } from './createDb';
import { JSONFile } from 'lowdb/node';
import { Low } from 'lowdb';

export default class DbService {

    private static instance: DbService;
    private db: Low<DbSchema> | null;
    private readonly adapter: JSONFile<DbSchema>;

    public constructor () {
        this.adapter = new JSONFile<DbSchema>('db.json');
        this.db = null;
    };

    public static getInstance (): DbService {
        if (!DbService.instance) {
            DbService.instance = new DbService();
        }
        return DbService.instance;
    };

    public async connect (): Promise<void> {
        this.db = new Low<DbSchema>(this.adapter, {});
        await this.db.read();
    };

    public getDb (): Low<DbSchema> | null {
        return this.db;
    };

    public async writeDb (): Promise<void> {
        if (this.db === null) {
            throw new Error('NO DB CONNECTION');
        }
        await this.db.write();
    };

    public async getData (): Promise<DbSchema> {
        if (this.db === null) {
            throw new Error('NO DB CONNECTION');
        }
        return this.db.data;
    };
}