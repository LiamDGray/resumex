/**
 * Database Configuration
 * 
 * Handles connection pooling and schema initialization for PostgreSQL
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let pool = null;
let isConnected = false;

/**
 * Connect to PostgreSQL database and initialize schema if needed
 */
async function connectDB() {
    if (isConnected && pool) {
        return pool;
    }

    try {
        const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/resumex';
        
        if (!pool) {
            pool = new Pool({
                connectionString,
                connectionTimeoutMillis: 2000
            });
        }

        // Test the connection
        const client = await pool.connect();
        client.release();

        isConnected = true;
        console.log('✅ PostgreSQL connected successfully');

        // Run schema initialization if tables do not exist
        await initializeSchema();

        return pool;
    } catch (error) {
        isConnected = false;
        console.error('❌ PostgreSQL connection error:', error.message);
        throw error;
    }
}

/**
 * Initialize database schema if resumes table does not exist
 */
async function initializeSchema() {
    try {
        // Check if the 'resumes' table exists
        const res = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'resumes'
            );
        `);
        
        const tableExists = res.rows[0].exists;
        if (!tableExists) {
            console.log('Initializing PostgreSQL schema...');
            const schemaPath = path.join(__dirname, '..', 'models', 'schema.sql');
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            await pool.query(schemaSql);
            console.log('✅ Schema initialized successfully');
        }
    } catch (error) {
        console.error('❌ Schema initialization error:', error.message);
        throw error;
    }
}

/**
 * Execute a query against the database
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 */
async function query(text, params) {
    if (!pool) {
        throw new Error('Database pool not initialized. Call connectDB first.');
    }
    return pool.query(text, params);
}

module.exports = {
    connectDB,
    query,
    getPool: () => pool,
    setPool: (p) => { pool = p; },
    getIsConnected: () => isConnected,
    setIsConnected: (val) => { isConnected = val; }
};
