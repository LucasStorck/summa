import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import db from './connection.js';

db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            executed_at DATETIME NOT NULL DEFAULT (datetime('now'))
        )`
);

async function runMigrations() {
  // ESM não tem __dirname; import.meta.dirname é a pasta deste arquivo (dist/db em execução).
  const migrationsDir = path.join(import.meta.dirname, 'migrations');
  // Em dist/ só existem .js (e .d.ts/.map, que este filtro já descarta).
  const migrationFiles = fs.readdirSync(migrationsDir).filter(file => file.endsWith('.js')).sort();

  // .all() retorna unknown[]; o "as" informa o formato das linhas ao TypeScript.
  const rows = db.prepare('SELECT name FROM _migrations').all() as { name: string }[];
  const executedMigrationsSet = new Set(rows.map(row => row.name));

  for (const migrationFile of migrationFiles) {
    if (executedMigrationsSet.has(migrationFile)) {
      continue; // já aplicada: não roda de novo
    }

    console.log(`Checking migration: ${migrationFile}`);

    const migrationPath = path.join(migrationsDir, migrationFile);
    // No Windows, import() exige URL file:// em vez de caminho C:\...
    const { up } = await import(pathToFileURL(migrationPath).href);

    if (typeof up === 'function') {
      const recordMigration = db.transaction(() => {
        up(db);
        db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migrationFile);
      });

      recordMigration();
      console.log(`Migration executed: ${migrationFile}`);
    } else {
      console.warn(`Migration file ${migrationFile} does not export an 'up' function.`);
    }
  }

  console.log('All migrations executed successfully.');
}

runMigrations().catch(error => {
  console.error('Error running migrations:', error);
  process.exit(1);
});
