export interface Cache {
  set<T>(url: string, value: T): Promise<T>;
  get(url: string): Promise<string | undefined>;
}

import SQLite from 'sqlite3';

export class CacheDB implements Cache {
  private db: Promise<SQLite.Database>;

  constructor(private readonly filename: string) {
    this.db = this.initTable()
    this.db.catch(err => {
      console.error('Failed to initialize DB:', filename);
      process.exit(1);
    });
  }

  private async initTable(): Promise<SQLite.Database> {
    return new Promise((resolve, reject) => {
      const db = new SQLite.Database(this.filename, (err) => {
        if (err) {
          console.error('Error opening database:', err.message);
        }
      });
      const CREATE_TABLE_SQL = `
        CREATE TABLE IF NOT EXISTS key_value_store (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `;
      db.run(CREATE_TABLE_SQL, (err) => {
        if (err) reject(err); else resolve(db);
      });
    });
  }

  async set<T>(key: string, value: T): Promise<T> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO key_value_store (key, value) VALUES (?, ?)`,
        [key, JSON.stringify(value)],
        (err) => {
          if (err) reject(err); else resolve(value);
        }
      );
    });
  }

  async get<T>(key: string): Promise<T | undefined> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      db.get<{value: string}>(
        `SELECT value FROM key_value_store WHERE key = ?`,
        [key],
        (err, row) => {
          if (err) reject(err); else resolve(row ? JSON.parse(row.value) : row);
        }
      );
    });
  }
}
