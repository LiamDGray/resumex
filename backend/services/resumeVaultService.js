/**
 * Resume Vault Service
 * 
 * Handles resume storage and retrieval from PostgreSQL with local JSON database fallback
 */

const fs = require('fs');
const path = require('path');
const db = require('../config/database');

const dbFilePath = path.join(__dirname, '..', 'resumes_db.json');

// Helper to read local database file
function readLocalDB() {
    try {
        if (!fs.existsSync(dbFilePath)) {
            return [];
        }
        const data = fs.readFileSync(dbFilePath, 'utf8');
        return JSON.parse(data || '[]');
    } catch (error) {
        console.error('Error reading local JSON DB:', error);
        return [];
    }
}

// Helper to write local database file
function writeLocalDB(data) {
    try {
        fs.writeFileSync(dbFilePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing local JSON DB:', error);
    }
}

/**
 * Map a database row (snake_case) to the camelCase Resume object format
 */
function mapRowToResume(row) {
    if (!row) return null;
    return {
        id: row.id,
        _id: row.id, // for compatibility
        jobTitle: row.job_title,
        company: row.company,
        githubUsername: row.github_username,
        resumeJSON: typeof row.resume_json === 'string' ? JSON.parse(row.resume_json) : row.resume_json,
        tailoringBlueprint: typeof row.tailoring_blueprint === 'string' ? JSON.parse(row.tailoring_blueprint) : row.tailoring_blueprint,
        jobDescription: row.job_description,
        justificationReport: row.justification_report ? (typeof row.justification_report === 'string' ? JSON.parse(row.justification_report) : row.justification_report) : null,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
    };
}

/**
 * Save a resume to the vault
 * @param {Object} data - Resume data
 * @returns {Promise<Object>} Saved resume document
 */
async function saveResume(data) {
    const { jobTitle, company, githubUsername, resumeJSON, tailoringBlueprint, jobDescription, justificationReport } = data;

    // Validation
    if (!jobTitle || !resumeJSON || !tailoringBlueprint) {
        throw new Error('Missing required fields: jobTitle, resumeJSON, tailoringBlueprint');
    }

    const id = data.id || data._id || 'res_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);

    if (db.getIsConnected()) {
        try {
            const queryText = `
                INSERT INTO resumes (id, job_title, company, github_username, resume_json, tailoring_blueprint, job_description, justification_report)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *;
            `;
            const values = [
                id,
                jobTitle,
                company || 'Unknown',
                githubUsername || null,
                typeof resumeJSON === 'object' ? JSON.stringify(resumeJSON) : resumeJSON,
                typeof tailoringBlueprint === 'object' ? JSON.stringify(tailoringBlueprint) : tailoringBlueprint,
                jobDescription || null,
                justificationReport ? (typeof justificationReport === 'object' ? JSON.stringify(justificationReport) : justificationReport) : null
            ];
            const res = await db.query(queryText, values);
            return mapRowToResume(res.rows[0]);
        } catch (error) {
            console.error('❌ PostgreSQL query failed on saveResume. Falling back to local JSON...', error.message);
        }
    }

    // Fallback path
    console.log('⚠️ PostgreSQL not connected or query failed. Saving resume to local JSON database...');
    const localDB = readLocalDB();
    const newResume = {
        id,
        _id: id,
        jobTitle,
        company: company || 'Unknown',
        githubUsername: githubUsername || null,
        resumeJSON,
        tailoringBlueprint,
        jobDescription: jobDescription || null,
        justificationReport: justificationReport || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    localDB.push(newResume);
    writeLocalDB(localDB);
    return newResume;
}

/**
 * Get all resumes from vault
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of resumes
 */
async function getAllResumes(options = {}) {
    const { limit = 50, skip = 0, sortBy = '-createdAt' } = options;

    if (db.getIsConnected()) {
        try {
            let sortColumn = 'created_at';
            let sortOrder = 'DESC';
            if (sortBy) {
                const desc = sortBy.startsWith('-');
                const cleanSortBy = desc ? sortBy.substring(1) : sortBy;
                let matched = false;
                if (cleanSortBy === 'createdAt') { sortColumn = 'created_at'; matched = true; }
                else if (cleanSortBy === 'updatedAt') { sortColumn = 'updated_at'; matched = true; }
                else if (cleanSortBy === 'jobTitle') { sortColumn = 'job_title'; matched = true; }
                else if (cleanSortBy === 'company') { sortColumn = 'company'; matched = true; }
                
                if (matched) {
                    sortOrder = desc ? 'DESC' : 'ASC';
                }
            }

            const queryText = `
                SELECT * FROM resumes
                ORDER BY ${sortColumn} ${sortOrder}
                LIMIT $1 OFFSET $2;
            `;
            const res = await db.query(queryText, [limit, skip]);
            return res.rows.map(mapRowToResume);
        } catch (error) {
            console.error('❌ PostgreSQL query failed on getAllResumes. Falling back to local JSON...', error.message);
        }
    }

    // Fallback path
    console.log('⚠️ PostgreSQL not connected or query failed. Fetching resumes from local JSON database...');
    let localDB = readLocalDB();
    
    // Sorting
    const sortField = sortBy.startsWith('-') ? sortBy.substring(1) : sortBy;
    const sortOrderFallback = sortBy.startsWith('-') ? -1 : 1;
    
    localDB.sort((a, b) => {
        const valA = a[sortField] || '';
        const valB = b[sortField] || '';
        if (valA < valB) return -1 * sortOrderFallback;
        if (valA > valB) return 1 * sortOrderFallback;
        return 0;
    });

    // Pagination
    return localDB.slice(skip, skip + limit);
}

/**
 * Get a single resume by ID
 * @param {string} id - Resume ID
 * @returns {Promise<Object>} Resume document
 */
async function getResumeById(id) {
    if (db.getIsConnected()) {
        try {
            const queryText = `SELECT * FROM resumes WHERE id = $1;`;
            const res = await db.query(queryText, [id]);
            if (res.rows.length === 0) {
                throw new Error('Resume not found');
            }
            return mapRowToResume(res.rows[0]);
        } catch (error) {
            if (error.message === 'Resume not found') {
                throw error;
            }
            console.error('❌ PostgreSQL query failed on getResumeById. Falling back to local JSON...', error.message);
        }
    }

    // Fallback path
    console.log('⚠️ PostgreSQL not connected or query failed. Fetching resume by ID from local JSON database...');
    const localDB = readLocalDB();
    const resume = localDB.find(item => item.id === id || item._id === id);
    if (!resume) {
        throw new Error('Resume not found');
    }
    return resume;
}

/**
 * Delete a resume by ID
 * @param {string} id - Resume ID
 * @returns {Promise<Object>} Deleted resume
 */
async function deleteResume(id) {
    if (db.getIsConnected()) {
        try {
            const queryText = `DELETE FROM resumes WHERE id = $1 RETURNING *;`;
            const res = await db.query(queryText, [id]);
            if (res.rows.length === 0) {
                throw new Error('Resume not found');
            }
            return mapRowToResume(res.rows[0]);
        } catch (error) {
            if (error.message === 'Resume not found') {
                throw error;
            }
            console.error('❌ PostgreSQL query failed on deleteResume. Falling back to local JSON...', error.message);
        }
    }

    // Fallback path
    console.log('⚠️ PostgreSQL not connected or query failed. Deleting resume from local JSON database...');
    let localDB = readLocalDB();
    const index = localDB.findIndex(item => item.id === id || item._id === id);
    if (index === -1) {
        throw new Error('Resume not found');
    }
    const [deleted] = localDB.splice(index, 1);
    writeLocalDB(localDB);
    return deleted;
}

/**
 * Search resumes by company or job title
 * @param {string} queryStr - Search query
 * @returns {Promise<Array>} Matching resumes
 */
async function searchResumes(queryStr) {
    if (db.getIsConnected()) {
        try {
            const queryText = `
                SELECT * FROM resumes
                WHERE job_title ILIKE $1 OR company ILIKE $1
                ORDER BY created_at DESC;
            `;
            const res = await db.query(queryText, [`%${queryStr}%`]);
            return res.rows.map(mapRowToResume);
        } catch (error) {
            console.error('❌ PostgreSQL query failed on searchResumes. Falling back to local JSON...', error.message);
        }
    }

    // Fallback path
    console.log('⚠️ PostgreSQL not connected or query failed. Searching local JSON database...');
    const localDB = readLocalDB();
    const regex = new RegExp(queryStr, 'i');
    const results = localDB.filter(item => 
        regex.test(item.jobTitle) || regex.test(item.company)
    );
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return results;
}

/**
 * Get resume statistics
 * @returns {Promise<Object>} Statistics
 */
async function getVaultStats() {
    if (db.getIsConnected()) {
        try {
            const totalCountRes = await db.query('SELECT COUNT(*) FROM resumes;');
            const totalResumes = parseInt(totalCountRes.rows[0].count, 10);

            const recentRes = await db.query(`
                SELECT job_title, company, created_at
                FROM resumes
                ORDER BY created_at DESC
                LIMIT 5;
            `);
            const recentResumes = recentRes.rows.map(row => ({
                jobTitle: row.job_title,
                company: row.company,
                createdAt: row.created_at ? new Date(row.created_at).toISOString() : null
            }));

            const companiesRes = await db.query(`
                SELECT company, COUNT(*) as count
                FROM resumes
                GROUP BY company
                ORDER BY count DESC, company ASC
                LIMIT 10;
            `);
            const topCompanies = companiesRes.rows.map(row => ({
                company: row.company,
                count: parseInt(row.count, 10)
            }));

            return {
                totalResumes,
                recentResumes,
                topCompanies
            };
        } catch (error) {
            console.error('❌ PostgreSQL query failed on getVaultStats. Falling back to local JSON...', error.message);
        }
    }

    // Fallback path
    console.log('⚠️ PostgreSQL not connected or query failed. Getting stats from local JSON database...');
    const localDB = readLocalDB();
    const totalResumes = localDB.length;
    
    const sorted = [...localDB].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const recentResumes = sorted.slice(0, 5).map(item => ({
        jobTitle: item.jobTitle,
        company: item.company,
        createdAt: item.createdAt
    }));

    const companyCounts = {};
    localDB.forEach(item => {
        const co = item.company || 'Unknown';
        companyCounts[co] = (companyCounts[co] || 0) + 1;
    });

    const topCompanies = Object.entries(companyCounts)
        .map(([company, count]) => ({ company, count }))
        .sort((a, b) => b.count - a.count || a.company.localeCompare(b.company))
        .slice(0, 10);

    return {
        totalResumes,
        recentResumes,
        topCompanies
    };
}

module.exports = {
    saveResume,
    getAllResumes,
    getResumeById,
    deleteResume,
    searchResumes,
    getVaultStats
};
