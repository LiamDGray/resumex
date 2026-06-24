/**
 * Unit tests for backend/services/resumeVaultService.js
 */

const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const resumeVaultService = require('../services/resumeVaultService');

jest.mock('../config/database', () => {
    return {
        getIsConnected: jest.fn(),
        query: jest.fn()
    };
});

jest.mock('fs');

describe('Resume Vault Service', () => {
    let mockLocalDB = [];

    beforeEach(() => {
        jest.clearAllMocks();
        mockLocalDB = [
            {
                id: 'local_1',
                _id: 'local_1',
                jobTitle: 'Software Engineer',
                company: 'Google',
                githubUsername: 'coder1',
                resumeJSON: { name: 'John Doe' },
                tailoringBlueprint: { sections: [] },
                jobDescription: 'Write code.',
                justificationReport: { score: 90 },
                createdAt: '2026-06-20T00:00:00.000Z',
                updatedAt: '2026-06-20T00:00:00.000Z'
            },
            {
                id: 'local_2',
                _id: 'local_2',
                jobTitle: 'Product Manager',
                company: 'Meta',
                githubUsername: 'pm1',
                resumeJSON: { name: 'Jane Doe' },
                tailoringBlueprint: { sections: [] },
                jobDescription: 'Manage products.',
                justificationReport: null,
                createdAt: '2026-06-21T00:00:00.000Z',
                updatedAt: '2026-06-21T00:00:00.000Z'
            },
            {
                id: 'local_3',
                _id: 'local_3',
                jobTitle: 'Designer',
                company: null, // trigger Unknown company branch in stats
                githubUsername: null,
                resumeJSON: { name: 'Bob' },
                tailoringBlueprint: { sections: [] },
                jobDescription: 'Design UI.',
                justificationReport: null,
                createdAt: '2026-06-22T00:00:00.000Z',
                updatedAt: '2026-06-22T00:00:00.000Z'
            }
        ];

        // Default fs mocks
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockImplementation(() => JSON.stringify(mockLocalDB));
        fs.writeFileSync.mockImplementation((file, data) => {
            mockLocalDB = JSON.parse(data);
        });
    });

    describe('saveResume', () => {
        const validData = {
            jobTitle: 'Frontend Engineer',
            company: 'Vercel',
            githubUsername: 'nextjs_dev',
            resumeJSON: { details: {} },
            tailoringBlueprint: { steps: [] },
            jobDescription: 'Build UI',
            justificationReport: { reason: 'great fit' }
        };

        test('should throw error if required fields are missing', async () => {
            await expect(resumeVaultService.saveResume({ jobTitle: 'Only Title' })).rejects.toThrow(
                'Missing required fields: jobTitle, resumeJSON, tailoringBlueprint'
            );
        });

        test('should save to PostgreSQL successfully when DB is connected', async () => {
            db.getIsConnected.mockReturnValue(true);
            const dbRow = {
                id: 'res_123',
                job_title: 'Frontend Engineer',
                company: 'Vercel',
                github_username: 'nextjs_dev',
                resume_json: JSON.stringify({ details: {} }),
                tailoring_blueprint: JSON.stringify({ steps: [] }),
                job_description: 'Build UI',
                justification_report: JSON.stringify({ reason: 'great fit' }),
                created_at: '2026-06-24T00:00:00.000Z',
                updated_at: '2026-06-24T00:00:00.000Z'
            };
            db.query.mockResolvedValueOnce({ rows: [dbRow] });

            const result = await resumeVaultService.saveResume(validData);

            expect(db.query).toHaveBeenCalled();
            expect(result.id).toBe('res_123');
            expect(result.jobTitle).toBe('Frontend Engineer');
            expect(result.resumeJSON).toEqual({ details: {} });
        });

        test('should fall back to local JSON when DB is connected but query fails', async () => {
            db.getIsConnected.mockReturnValue(true);
            db.query.mockRejectedValueOnce(new Error('Database write error'));

            const result = await resumeVaultService.saveResume(validData);

            expect(db.query).toHaveBeenCalled();
            expect(result.id).toContain('res_');
            expect(result.company).toBe('Vercel');
            expect(mockLocalDB.length).toBe(4);
            expect(mockLocalDB[3].jobTitle).toBe('Frontend Engineer');
        });

        test('should save to local JSON when DB is not connected', async () => {
            db.getIsConnected.mockReturnValue(false);

            const result = await resumeVaultService.saveResume(validData);

            expect(db.query).not.toHaveBeenCalled();
            expect(result.id).toContain('res_');
            expect(result.company).toBe('Vercel');
            expect(mockLocalDB.length).toBe(4);
        });

        test('should use provided id or _id if present in data', async () => {
            db.getIsConnected.mockReturnValue(false);
            const customData = { ...validData, id: 'custom_id' };
            const result = await resumeVaultService.saveResume(customData);
            expect(result.id).toBe('custom_id');
        });
    });

    describe('getAllResumes', () => {
        test('should fetch from PostgreSQL successfully when DB is connected', async () => {
            db.getIsConnected.mockReturnValue(true);
            const dbRows = [
                {
                    id: 'res_1',
                    job_title: 'Software Engineer',
                    company: 'Google',
                    github_username: 'coder1',
                    resume_json: { name: 'John Doe' },
                    tailoring_blueprint: { sections: [] },
                    job_description: 'Write code.',
                    justification_report: { score: 90 },
                    created_at: '2026-06-20T00:00:00.000Z',
                    updated_at: '2026-06-20T00:00:00.000Z'
                }
            ];
            db.query.mockResolvedValueOnce({ rows: dbRows });

            const results = await resumeVaultService.getAllResumes({ sortBy: 'createdAt' });

            expect(db.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY created_at ASC'), expect.any(Array));
            expect(results.length).toBe(1);
            expect(results[0].jobTitle).toBe('Software Engineer');
        });

        test('should support sorting by various fields in PostgreSQL', async () => {
            db.getIsConnected.mockReturnValue(true);
            db.query.mockResolvedValue({ rows: [] });

            await resumeVaultService.getAllResumes({ sortBy: '-updatedAt' });
            expect(db.query).toHaveBeenLastCalledWith(expect.stringContaining('ORDER BY updated_at DESC'), expect.any(Array));

            await resumeVaultService.getAllResumes({ sortBy: 'jobTitle' });
            expect(db.query).toHaveBeenLastCalledWith(expect.stringContaining('ORDER BY job_title ASC'), expect.any(Array));

            await resumeVaultService.getAllResumes({ sortBy: '-company' });
            expect(db.query).toHaveBeenLastCalledWith(expect.stringContaining('ORDER BY company DESC'), expect.any(Array));

            await resumeVaultService.getAllResumes({ sortBy: 'unknownField' });
            expect(db.query).toHaveBeenLastCalledWith(expect.stringContaining('ORDER BY created_at DESC'), expect.any(Array));
        });

        test('should fall back to local JSON when DB is connected but query fails', async () => {
            db.getIsConnected.mockReturnValue(true);
            db.query.mockRejectedValueOnce(new Error('Database read error'));

            const results = await resumeVaultService.getAllResumes({ sortBy: '-createdAt' });

            expect(db.query).toHaveBeenCalled();
            expect(results.length).toBe(3);
            // Verify sorting: local_3 (2026-06-22) should come first, then local_2 (2026-06-21), then local_1 (2026-06-20)
            expect(results[0].id).toBe('local_3');
        });

        test('should fetch from local JSON when DB is not connected', async () => {
            db.getIsConnected.mockReturnValue(false);

            const results = await resumeVaultService.getAllResumes({ sortBy: 'createdAt', limit: 1, skip: 1 });

            expect(db.query).not.toHaveBeenCalled();
            expect(results.length).toBe(1);
            expect(results[0].id).toBe('local_2'); // sorted asc (local_1, local_2, local_3), skipped 1st
        });
    });

    describe('getResumeById', () => {
        test('should fetch from PostgreSQL successfully when DB is connected', async () => {
            db.getIsConnected.mockReturnValue(true);
            const dbRow = {
                id: 'res_123',
                job_title: 'Engineer',
                company: 'Google',
                resume_json: '{}',
                tailoring_blueprint: '{}'
            };
            db.query.mockResolvedValueOnce({ rows: [dbRow] });

            const result = await resumeVaultService.getResumeById('res_123');

            expect(db.query).toHaveBeenCalledWith(expect.stringContaining('id = $1'), ['res_123']);
            expect(result.id).toBe('res_123');
        });

        test('should throw error if not found in PostgreSQL', async () => {
            db.getIsConnected.mockReturnValue(true);
            db.query.mockResolvedValueOnce({ rows: [] });

            await expect(resumeVaultService.getResumeById('res_nonexistent')).rejects.toThrow('Resume not found');
        });

        test('should fall back to local JSON on query failure', async () => {
            db.getIsConnected.mockReturnValue(true);
            db.query.mockRejectedValueOnce(new Error('Query failed'));

            const result = await resumeVaultService.getResumeById('local_1');

            expect(result.id).toBe('local_1');
        });

        test('should fetch from local JSON when DB is not connected', async () => {
            db.getIsConnected.mockReturnValue(false);

            const result = await resumeVaultService.getResumeById('local_2');

            expect(result.id).toBe('local_2');
        });

        test('should throw error if not found in local JSON', async () => {
            db.getIsConnected.mockReturnValue(false);

            await expect(resumeVaultService.getResumeById('local_nonexistent')).rejects.toThrow('Resume not found');
        });
    });

    describe('deleteResume', () => {
        test('should delete from PostgreSQL successfully when DB is connected', async () => {
            db.getIsConnected.mockReturnValue(true);
            const dbRow = {
                id: 'res_123',
                job_title: 'Engineer',
                company: 'Google',
                resume_json: '{}',
                tailoring_blueprint: '{}'
            };
            db.query.mockResolvedValueOnce({ rows: [dbRow] });

            const result = await resumeVaultService.deleteResume('res_123');

            expect(db.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM resumes'), ['res_123']);
            expect(result.id).toBe('res_123');
        });

        test('should throw error if not found in PostgreSQL for deletion', async () => {
            db.getIsConnected.mockReturnValue(true);
            db.query.mockResolvedValueOnce({ rows: [] });

            await expect(resumeVaultService.deleteResume('res_nonexistent')).rejects.toThrow('Resume not found');
        });

        test('should fall back to local JSON on query failure during deletion', async () => {
            db.getIsConnected.mockReturnValue(true);
            db.query.mockRejectedValueOnce(new Error('Delete failed'));

            const result = await resumeVaultService.deleteResume('local_1');

            expect(result.id).toBe('local_1');
            expect(mockLocalDB.length).toBe(2);
        });

        test('should delete from local JSON when DB is not connected', async () => {
            db.getIsConnected.mockReturnValue(false);

            const result = await resumeVaultService.deleteResume('local_2');

            expect(result.id).toBe('local_2');
            expect(mockLocalDB.length).toBe(2);
            expect(mockLocalDB.find(item => item.id === 'local_2')).toBeUndefined();
        });

        test('should throw error if trying to delete nonexistent from local JSON', async () => {
            db.getIsConnected.mockReturnValue(false);

            await expect(resumeVaultService.deleteResume('local_nonexistent')).rejects.toThrow('Resume not found');
        });
    });

    describe('searchResumes', () => {
        test('should search in PostgreSQL successfully when DB is connected', async () => {
            db.getIsConnected.mockReturnValue(true);
            const dbRow = {
                id: 'res_123',
                job_title: 'Software Engineer',
                company: 'Google',
                resume_json: '{}',
                tailoring_blueprint: '{}'
            };
            db.query.mockResolvedValueOnce({ rows: [dbRow] });

            const results = await resumeVaultService.searchResumes('Google');

            expect(db.query).toHaveBeenCalledWith(expect.stringContaining('ILIKE'), ['%Google%']);
            expect(results.length).toBe(1);
            expect(results[0].id).toBe('res_123');
        });

        test('should fall back to local JSON on query failure during search', async () => {
            db.getIsConnected.mockReturnValue(true);
            db.query.mockRejectedValueOnce(new Error('Search failed'));

            const results = await resumeVaultService.searchResumes('Google');

            expect(results.length).toBe(1);
            expect(results[0].id).toBe('local_1');
        });

        test('should search local JSON when DB is not connected', async () => {
            db.getIsConnected.mockReturnValue(false);

            const results = await resumeVaultService.searchResumes('Meta');

            expect(results.length).toBe(1);
            expect(results[0].id).toBe('local_2');
        });
    });

    describe('getVaultStats', () => {
        test('should fetch stats from PostgreSQL successfully when DB is connected', async () => {
            db.getIsConnected.mockReturnValue(true);
            db.query
                .mockResolvedValueOnce({ rows: [{ count: '12' }] }) // total count
                .mockResolvedValueOnce({ // recent resumes
                    rows: [
                        { job_title: 'Engineer', company: 'Google', created_at: '2026-06-24T00:00:00.000Z' },
                        { job_title: 'Developer', company: 'Microsoft', created_at: null } // covers null created_at branch
                    ]
                })
                .mockResolvedValueOnce({ // top companies
                    rows: [
                        { company: 'Google', count: '8' },
                        { company: 'Meta', count: '4' }
                    ]
                });

            const stats = await resumeVaultService.getVaultStats();

            expect(db.query).toHaveBeenCalledTimes(3);
            expect(stats.totalResumes).toBe(12);
            expect(stats.recentResumes[0].jobTitle).toBe('Engineer');
            expect(stats.recentResumes[1].createdAt).toBeNull();
            expect(stats.topCompanies[0].company).toBe('Google');
            expect(stats.topCompanies[0].count).toBe(8);
        });

        test('should fall back to local JSON on query failure during stats', async () => {
            db.getIsConnected.mockReturnValue(true);
            db.query.mockRejectedValueOnce(new Error('Stats query failed'));

            const stats = await resumeVaultService.getVaultStats();

            expect(stats.totalResumes).toBe(3);
            expect(stats.recentResumes.length).toBe(3);
            expect(stats.topCompanies[0].company).toBe('Google'); // Sorted alphabetically on equal count
            expect(stats.topCompanies[1].company).toBe('Meta');
            expect(stats.topCompanies[2].company).toBe('Unknown'); // covers null company mapping to Unknown
        });

        test('should fetch stats from local JSON when DB is not connected', async () => {
            db.getIsConnected.mockReturnValue(false);

            const stats = await resumeVaultService.getVaultStats();

            expect(stats.totalResumes).toBe(3);
            expect(stats.recentResumes.length).toBe(3);
            expect(stats.topCompanies[0].company).toBe('Google');
            expect(stats.topCompanies[2].company).toBe('Unknown');
        });
    });

    describe('mapRowToResume edge cases', () => {
        test('should handle stringified and object fields in database rows', async () => {
            db.getIsConnected.mockReturnValue(true);
            const dbRows = [
                {
                    id: 'res_string',
                    job_title: 'Title',
                    company: 'Company',
                    github_username: 'github',
                    resume_json: JSON.stringify({ key: 'value' }),
                    tailoring_blueprint: JSON.stringify({ key: 'blueprint' }),
                    job_description: 'Desc',
                    justification_report: JSON.stringify({ key: 'report' }),
                    created_at: '2026-06-20T00:00:00.000Z',
                    updated_at: '2026-06-20T00:00:00.000Z'
                },
                {
                    id: 'res_object',
                    job_title: 'Title',
                    company: 'Company',
                    github_username: null,
                    resume_json: { key: 'value' },
                    tailoring_blueprint: { key: 'blueprint' },
                    job_description: null,
                    justification_report: null,
                    created_at: null,
                    updated_at: null
                }
            ];
            db.query.mockResolvedValueOnce({ rows: dbRows });

            const results = await resumeVaultService.getAllResumes();
            
            expect(results[0].resumeJSON).toEqual({ key: 'value' });
            expect(results[0].tailoringBlueprint).toEqual({ key: 'blueprint' });
            expect(results[0].justificationReport).toEqual({ key: 'report' });
            
            expect(results[1].resumeJSON).toEqual({ key: 'value' });
            expect(results[1].githubUsername).toBeNull();
            expect(results[1].createdAt).toBeNull();
        });

        test('should handle null row mapping', async () => {
            db.getIsConnected.mockReturnValue(true);
            db.query.mockResolvedValueOnce({ rows: [null] });
            const results = await resumeVaultService.getAllResumes();
            expect(results).toEqual([null]);
        });
    });

    describe('local DB sorting edge cases', () => {
        test('should cover return 0 in fallback sort comparator when values are equal', async () => {
            db.getIsConnected.mockReturnValue(false);
            mockLocalDB = [
                { id: '1', createdAt: '2026-06-20T00:00:00.000Z', jobTitle: 'A', resumeJSON: {}, tailoringBlueprint: {} },
                { id: '2', createdAt: '2026-06-20T00:00:00.000Z', jobTitle: 'B', resumeJSON: {}, tailoringBlueprint: {} }
            ];
            const results = await resumeVaultService.getAllResumes({ sortBy: 'createdAt' });
            expect(results.length).toBe(2);
        });

        test('should cover all comparator branches including <, >, and missing values', async () => {
            db.getIsConnected.mockReturnValue(false);
            
            mockLocalDB = [
                { id: '1', jobTitle: 'A', company: 'Google', createdAt: '2026-06-20T00:00:00.000Z', resumeJSON: {}, tailoringBlueprint: {} },
                { id: '2', jobTitle: 'B', company: null, createdAt: '2026-06-21T00:00:00.000Z', resumeJSON: {}, tailoringBlueprint: {} },
                { id: '3', jobTitle: null, company: 'Meta', createdAt: '2026-06-19T00:00:00.000Z', resumeJSON: {}, tailoringBlueprint: {} }
            ];

            // Sort ascending by jobTitle (covers null vs string, string vs null, string vs string)
            await resumeVaultService.getAllResumes({ sortBy: 'jobTitle' });

            // Sort descending by jobTitle
            await resumeVaultService.getAllResumes({ sortBy: '-jobTitle' });

            // Sort ascending by company (covers null vs string, string vs null, string vs string)
            await resumeVaultService.getAllResumes({ sortBy: 'company' });

            // Sort descending by company
            await resumeVaultService.getAllResumes({ sortBy: '-company' });
        });
    });

    describe('local JSON database error handling', () => {
        test('readLocalDB should return empty array and log error when JSON parsing fails', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('invalid json');

            // Trigger a read through getAllResumes
            db.getIsConnected.mockReturnValue(false);
            
            const spyError = jest.spyOn(console, 'error').mockImplementation(() => {});
            
            return resumeVaultService.getAllResumes().then(results => {
                expect(results).toEqual([]);
                expect(spyError).toHaveBeenCalledWith(expect.stringContaining('Error reading local JSON DB:'), expect.any(Error));
                spyError.mockRestore();
            });
        });

        test('readLocalDB should return empty array if file does not exist', () => {
            fs.existsSync.mockReturnValue(false);
            db.getIsConnected.mockReturnValue(false);

            return resumeVaultService.getAllResumes().then(results => {
                expect(results).toEqual([]);
            });
        });

        test('writeLocalDB should log error if write fails', async () => {
            fs.writeFileSync.mockImplementationOnce(() => {
                throw new Error('Write permission denied');
            });
            db.getIsConnected.mockReturnValue(false);
            
            const spyError = jest.spyOn(console, 'error').mockImplementation(() => {});

            await resumeVaultService.saveResume({
                jobTitle: 'Test',
                resumeJSON: {},
                tailoringBlueprint: {}
            });

            expect(spyError).toHaveBeenCalledWith(expect.stringContaining('Error writing local JSON DB:'), expect.any(Error));
            spyError.mockRestore();
        });
    });

    describe('additional coverage edge cases', () => {
        test('should cover company, githubUsername, jobDescription, justificationReport null/falsy fallback and stringified inputs in saveResume DB path', async () => {
            db.getIsConnected.mockReturnValue(true);
            const dbRow = {
                id: 'res_123',
                job_title: 'Title',
                company: 'Unknown',
                github_username: null,
                resume_json: '{}',
                tailoring_blueprint: '{}',
                job_description: null,
                justification_report: '{"score": 95}',
                created_at: null,
                updated_at: null
            };
            db.query.mockResolvedValueOnce({ rows: [dbRow] });

            const result = await resumeVaultService.saveResume({
                jobTitle: 'Title',
                company: '',
                githubUsername: '',
                resumeJSON: '{}',
                tailoringBlueprint: '{}',
                jobDescription: '',
                justificationReport: '{"score": 95}'
            });

            expect(result.company).toBe('Unknown');
            expect(result.githubUsername).toBeNull();
            expect(result.justificationReport).toEqual({ score: 95 });

            // Run second save with falsy justificationReport in DB path to cover the falsy branch
            db.query.mockResolvedValueOnce({ rows: [{ ...dbRow, justification_report: null }] });
            const result2 = await resumeVaultService.saveResume({
                jobTitle: 'Title',
                company: '',
                githubUsername: '',
                resumeJSON: '{}',
                tailoringBlueprint: '{}',
                jobDescription: '',
                justificationReport: null
            });
            expect(result2.justificationReport).toBeNull();
        });

        test('should cover falsy sortBy in getAllResumes DB path', async () => {
            db.getIsConnected.mockReturnValue(true);
            db.query.mockResolvedValueOnce({ rows: [] });

            await resumeVaultService.getAllResumes({ sortBy: null });
            expect(db.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY created_at DESC'), expect.any(Array));
        });

        test('should cover falsy readLocalDB data fallback', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(''); // falsy to trigger || '[]'

            db.getIsConnected.mockReturnValue(false);
            const results = await resumeVaultService.getAllResumes();
            expect(results).toEqual([]);
        });
    });
});
