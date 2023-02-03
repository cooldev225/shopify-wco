import sqlite3 from 'sqlite3';
import {RdbmsConnection} from '@shopify/shopify-app-session-storage';

export class SqliteConnection implements RdbmsConnection {
  sessionDBIdentifier: string;
  useHasTable: boolean;

  constructor(private db: sqlite3.Database, sessionDBIdentifier: string) {
    this.db = db;
    this.sessionDBIdentifier = sessionDBIdentifier;
    this.useHasTable = true;
  }

  query(query: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    });
  }

  async hasTable(tablename: string): Promise<boolean> {
    const query = `
    SELECT name FROM sqlite_schema
    WHERE
      type = 'table' AND
      name = ${this.getArgumentPlaceholder()};
    `;
    const rows = await this.query(query, [tablename]);
    return rows.length === 1;
  }

  getArgumentPlaceholder(_?: number): string {
    return `?`;
  }

  connect(): Promise<void> {
    // Nothing to do here
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    // Nothing to do here
    return Promise.resolve();
  }
}
