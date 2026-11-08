import Database from 'better-sqlite3';

let db: Database.Database;

try{
    db = new Database('app.db', { 
        timeout: 5000,
    });

    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    console.log('Database connection established successfully.');
} catch (error) {
    if (error instanceof Error) {
        console.error('Error establishing database connection:', error.message);
    } else {
        console.error('Error establishing database connection:', error);
    }

    process.exit(1);
}

export default db;