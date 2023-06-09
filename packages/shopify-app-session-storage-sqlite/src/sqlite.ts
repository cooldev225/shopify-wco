import {Session} from '@shopify/shopify-api';
import {
  SessionStorage,
  RdbmsSessionStorageOptions,
} from '@shopify/shopify-app-session-storage';
import sqlite3 from 'sqlite3';

import {SqliteConnection} from './sqlite-connection';
import {migrationList} from './migrations';
import {SqliteSessionStorageMigrator} from './sqlite-migrator';

export interface SQLiteSessionStorageOptions
  extends RdbmsSessionStorageOptions {}

const defaultSQLiteSessionStorageOptions: SQLiteSessionStorageOptions = {
  sessionTableName: 'shopify_sessions',
  migratorOptions: {
    migrationDBIdentifier: 'shopify_sessions_migrations',
    migrationNameColumnName: 'migration_name',
  },
};

export class SQLiteSessionStorage implements SessionStorage {
  public readonly ready: Promise<void>;
  private options: SQLiteSessionStorageOptions;
  private db: SqliteConnection;
  private internalInit: Promise<void>;
  private migrator: SqliteSessionStorageMigrator;

  constructor(
    database: string | sqlite3.Database,
    opts: Partial<SQLiteSessionStorageOptions> = {},
  ) {
    this.options = {...defaultSQLiteSessionStorageOptions, ...opts};
    this.db = new SqliteConnection(database, this.options.sessionTableName);
    this.internalInit = this.init();
    this.migrator = new SqliteSessionStorageMigrator(
      this.db,
      this.options.migratorOptions,
      migrationList,
    );
    this.ready = this.migrator.applyMigrations(this.internalInit);
  }

  public async storeSession(session: Session): Promise<boolean> {
    await this.ready;

    // Note milliseconds to seconds conversion for `expires` property
    const entries = session
      .toPropertyArray()
      .map(([key, value]) =>
        key === 'expires'
          ? [key, Math.floor((value as number) / 1000)]
          : [key, value],
      );

    const query = `
      INSERT OR REPLACE INTO ${this.options.sessionTableName}
      (${entries.map(([key]) => key).join(', ')})
      VALUES (${entries
        .map(() => `${this.db.getArgumentPlaceholder()}`)
        .join(', ')});
    `;

    await this.db.query(
      query,
      entries.map(([_key, value]) => value),
    );
    return true;
  }

  public async loadSession(id: string): Promise<Session | undefined> {
    await this.ready;
    const query = `
      SELECT * FROM ${this.options.sessionTableName}
      WHERE id = ${this.db.getArgumentPlaceholder()};
    `;
    const rows = await this.db.query(query, [id]);
    if (!Array.isArray(rows) || rows?.length !== 1) return undefined;
    const rawResult = rows[0] as any;
    return this.databaseRowToSession(rawResult);
  }

  public async deleteSession(id: string): Promise<boolean> {
    await this.ready;
    const query = `
      DELETE FROM ${this.options.sessionTableName}
      WHERE id = ${this.db.getArgumentPlaceholder()};
    `;
    await this.db.query(query, [id]);
    return true;
  }

  public async deleteSessions(ids: string[]): Promise<boolean> {
    await this.ready;
    const query = `
      DELETE FROM ${this.options.sessionTableName}
      WHERE id IN (${ids
        .map(() => `${this.db.getArgumentPlaceholder()}`)
        .join(',')});
    `;
    await this.db.query(query, ids);
    return true;
  }

  public async findSessionsByShop(shop: string): Promise<Session[]> {
    await this.ready;
    const query = `
      SELECT * FROM ${this.options.sessionTableName}
      WHERE shop = ${this.db.getArgumentPlaceholder()};
    `;
    const rows = await this.db.query(query, [shop]);
    if (!Array.isArray(rows) || rows?.length === 0) return [];

    const results: Session[] = rows.map((row: any) => {
      return this.databaseRowToSession(row);
    });
    return results;
  }

  private async init() {
    const hasSessionTable = await this.db.hasTable(
      this.options.sessionTableName,
    );
    if (!hasSessionTable) {
      const query = `
        CREATE TABLE ${this.options.sessionTableName} (
          id varchar(255) NOT NULL PRIMARY KEY,
          shop varchar(255) NOT NULL,
          state varchar(255) NOT NULL,
          isOnline integer NOT NULL,
          expires integer,
          scope varchar(1024),
          accessToken varchar(255),
          onlineAccessInfo varchar(255)
        );
      `;
      await this.db.query(query);
    }
  }

  private databaseRowToSession(row: any): Session {
    // convert seconds to milliseconds prior to creating Session object
    if (row.expires) row.expires *= 1000;
    return Session.fromPropertyArray(Object.entries(row));
  }
}
