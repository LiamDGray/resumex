/**
 * Unit tests for backend/config/database.js
 */

const fs = require('fs');
const path = require('path');

// Mock pg module
const mockClient = {
    release: jest.fn()
};

const mockPoolInstance = {
    connect: jest.fn(),
    query: jest.fn()
};

jest.mock('pg', () => {
    return {
        Pool: jest.fn(() => mockPoolInstance)
    };
});

describe('Database Configuration', () => {
    let db;

    beforeEach(() => {
        // Reset pool mock functions to clean up history and implementations
        mockPoolInstance.connect.mockReset();
        mockPoolInstance.query.mockReset();

        // Spy on fs.readFileSync to mock schema.sql reading conditionally to avoid breaking Jest/Babel internal requires
        const originalReadFileSync = fs.readFileSync;
        jest.spyOn(fs, 'readFileSync').mockImplementation((filePath, options) => {
            if (typeof filePath === 'string' && filePath.includes('schema.sql')) {
                return 'CREATE TABLE resumes (id VARCHAR(255) PRIMARY KEY);';
            }
            return originalReadFileSync(filePath, options);
        });

        // Reset modules to clear cached state (pool, isConnected)
        jest.resetModules();
        db = require('../config/database');
        
        // Setup default mock behaviors
        mockPoolInstance.connect.mockResolvedValue(mockClient);
        mockPoolInstance.query.mockResolvedValue({ rows: [{ exists: true }] });
    });

    afterEach(() => {
        // Restore all spies
        jest.restoreAllMocks();
        
        const pool = db.getPool();
        if (pool && pool.end) {
            pool.end();
        }
    });

    test('getIsConnected should return false initially', () => {
        expect(db.getIsConnected()).toBe(false);
    });

    test('getPool should return null initially', () => {
        expect(db.getPool()).toBeNull();
    });

    test('setIsConnected should update connection state', () => {
        db.setIsConnected(true);
        expect(db.getIsConnected()).toBe(true);
    });

    test('setPool should update the pool instance', () => {
        const dummyPool = { query: jest.fn() };
        db.setPool(dummyPool);
        expect(db.getPool()).toBe(dummyPool);
    });

    test('connectDB should connect successfully and skip schema initialization if table exists', async () => {
        mockPoolInstance.connect.mockResolvedValueOnce(mockClient);
        mockPoolInstance.query.mockResolvedValueOnce({ rows: [{ exists: true }] });

        const pool = await db.connectDB();

        expect(pool).toBe(mockPoolInstance);
        expect(db.getIsConnected()).toBe(true);
        expect(mockPoolInstance.connect).toHaveBeenCalled();
        expect(mockPoolInstance.query).toHaveBeenCalledWith(expect.stringContaining('SELECT EXISTS'));
        expect(fs.readFileSync).not.toHaveBeenCalledWith(expect.stringContaining('schema.sql'), 'utf8');
    });

    test('connectDB should connect successfully and run schema initialization if table does not exist', async () => {
        mockPoolInstance.connect.mockResolvedValueOnce(mockClient);
        // First query returns false for exists, second query runs schema.sql
        mockPoolInstance.query
            .mockResolvedValueOnce({ rows: [{ exists: false }] })
            .mockResolvedValueOnce({ rows: [] });

        const pool = await db.connectDB();

        expect(pool).toBe(mockPoolInstance);
        expect(db.getIsConnected()).toBe(true);
        expect(mockPoolInstance.connect).toHaveBeenCalled();
        expect(mockPoolInstance.query).toHaveBeenCalledTimes(2);
        expect(fs.readFileSync).toHaveBeenCalled();
    });

    test('connectDB should reuse existing connection if already connected', async () => {
        // First connection
        await db.connectDB();
        expect(mockPoolInstance.connect).toHaveBeenCalledTimes(1);

        // Second connection
        const pool = await db.connectDB();
        expect(pool).toBe(mockPoolInstance);
        expect(mockPoolInstance.connect).toHaveBeenCalledTimes(1); // Not called again
    });

    test('connectDB should use DATABASE_URL env variable if present', async () => {
        const originalUrl = process.env.DATABASE_URL;
        process.env.DATABASE_URL = 'postgresql://testuser:testpass@testhost:5432/testdb';
        
        try {
            await db.connectDB();
            expect(db.getIsConnected()).toBe(true);
        } finally {
            if (originalUrl) {
                process.env.DATABASE_URL = originalUrl;
            } else {
                delete process.env.DATABASE_URL;
            }
        }
    });

    test('connectDB should not recreate pool if pool exists but isConnected is false', async () => {
        db.setIsConnected(false);
        const dummyPool = { 
            connect: jest.fn().mockResolvedValue(mockClient), 
            query: jest.fn().mockResolvedValue({ rows: [{ exists: true }] }) 
        };
        db.setPool(dummyPool);

        await db.connectDB();
        
        expect(db.getPool()).toBe(dummyPool);
        expect(dummyPool.connect).toHaveBeenCalled();
    });

    test('connectDB should handle connection errors gracefully', async () => {
        const connError = new Error('Connection refused');
        mockPoolInstance.connect.mockRejectedValueOnce(connError);

        await expect(db.connectDB()).rejects.toThrow('Connection refused');
        expect(db.getIsConnected()).toBe(false);
    });

    test('connectDB should handle schema initialization errors gracefully', async () => {
        mockPoolInstance.connect.mockResolvedValueOnce(mockClient);
        // Schema check query throws an error
        mockPoolInstance.query.mockRejectedValueOnce(new Error('Database error'));

        await expect(db.connectDB()).rejects.toThrow('Database error');
        expect(db.getIsConnected()).toBe(false);
    });

    test('query should execute query successfully when pool is initialized', async () => {
        mockPoolInstance.query
            .mockResolvedValueOnce({ rows: [{ exists: true }] }) // schema check query
            .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // test query
        
        // Initialize pool by calling connectDB
        await db.connectDB();
        
        const result = await db.query('SELECT * FROM resumes WHERE id = $1', [1]);
        expect(result.rows).toEqual([{ id: 1 }]);
        expect(mockPoolInstance.query).toHaveBeenLastCalledWith('SELECT * FROM resumes WHERE id = $1', [1]);
    });

    test('query should throw an error if pool is not initialized', async () => {
        await expect(db.query('SELECT * FROM resumes', [])).rejects.toThrow(
            'Database pool not initialized. Call connectDB first.'
        );
    });
});
