const { sql } = require('@vercel/postgres');

// Function to initialize the database table
async function initDB() {
    try {
        await sql`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE,
                password_hash TEXT,
                high_score INTEGER DEFAULT 0
            );
        `;
        console.log("Users table check/creation successful.");
    } catch (error) {
        console.error("Error initializing database:", error);
    }
}

// Initialize on start (Note: In serverless, this might run often, which is okay for IF NOT EXISTS)
initDB();

module.exports = { sql };
