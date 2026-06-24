require('dotenv').config({ override: true });
const db = require('./config/database');

// Import phase modules
const { parseJobDescription } = require('./services/jdParser');
const { fetchGitHubProfile } = require('./services/githubService');
const { generateTailoringBlueprint } = require('./services/tailoringService');
const { createResumePrompt } = require('./promptTemplate');
const { initializeProvider } = require('./services/llmProvider');
const mockUserProfile = require('./mockData');
const { generateResumePDF } = require('./services/pdfExportService');
const { connectDB } = require('./config/database');
const { saveResume } = require('./services/resumeVaultService');
const jobDescription = `
Senior Full-Stack Developer
We are looking for an experienced Full-Stack Developer with 5+ years of experience.
Required Skills:
- React, Node.js, TypeScript
- MongoDB, PostgreSQL
- Docker, Kubernetes
- AWS or Azure
Responsibilities:
- Build scalable REST APIs
- Develop responsive web applications
- Work with cross-functional teams
- Mentor junior developers
Qualifications:
- Bachelor's degree in Computer Science
- Strong problem-solving skills
- Experience with microservices architecture
`;

async function testAllPhases() {
    console.log("==================================================");
    console.log("🚀 STARTING RESUMEX PHASES TEST SUITE");
    console.log("==================================================\n");

    try {
        // --- Phase 2: JD Parser ---
        console.log("--- Testing Phase 2: Job Description Parser ---");
        const parsedJD = parseJobDescription(jobDescription);
        console.log("✅ Parsed Role:", parsedJD.role);
        console.log("✅ Parsed Skills:", parsedJD.skills);
        console.log("✅ Parsed Experience:", parsedJD.experience);
        console.log();

        // --- Phase 3: GitHub ---
        console.log("--- Testing Phase 3: GitHub Aggregation ---");
        const testUsername = 'octocat';
        let githubProfile;
        try {
            githubProfile = await fetchGitHubProfile(testUsername);
            console.log(`✅ Fetched GitHub for ${testUsername}`);
            console.log(`✅ Top Languages:`, githubProfile.topLanguages.slice(0, 3));
            console.log(`✅ Projects Found:`, githubProfile.projects.length);
        } catch (e) {
            console.warn(`⚠️ GitHub fetch failed (could be rate limit):`, e.message);
            githubProfile = { topLanguages: [], projects: [], stats: {} };
        }
        console.log();

        // --- Phase 4: Tailoring Logic ---
        console.log("--- Testing Phase 4: Tailoring Logic ---");
        const blueprint = generateTailoringBlueprint(parsedJD, mockUserProfile, githubProfile);
        console.log("✅ Matched Skills:", blueprint.matchedSkills);
        console.log("✅ Missing Skills:", blueprint.missingSkills);
        console.log("✅ Recommended Projects:", blueprint.recommendedProjects.map(p => p.name));
        console.log("✅ Experience Match Level:", blueprint.experienceMatchLevel);
        console.log();

        // --- Phase 1: LLM Generation ---
        console.log("✅ LLM Provider configured as:", process.env.LLM_PROVIDER);
        let llmProvider;
        try {
            const provider = process.env.LLM_PROVIDER || 'openai';
            let apiKey, model;
            if (provider === 'gemini') {
                apiKey = process.env.GEMINI_API_KEY;
                model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
            } else if (provider === 'openrouter') {
                apiKey = process.env.OPENROUTER_API_KEY;
                model = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-lite-preview-02-05:free';
            } else {
                apiKey = process.env.OPENAI_API_KEY;
                model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
            }
            llmProvider = initializeProvider({ provider, apiKey, model });
            console.log(`✅ LLM initialized successfully with model: ${model}`);

            const prompt = createResumePrompt(jobDescription, mockUserProfile, blueprint);
            console.log(`✅ Prompt compiled successfully! Expected output is JSON.`);
        } catch (err) {
            console.warn('⚠️ LLM Setup failed (continuing without LLM):', err.message);
        }
        console.log();

        // Skip actual LLM call to save time/tokens unless requested, generating fake data instead.
        const fakeResumeData = {
            personalInfo: { name: "Test User", email: "test@example.com" },
            professionalSummary: "Test Summary",
            skills: { technical: blueprint.matchedSkills }
        };

        // --- Phase 6: PDF Export ---
        console.log("--- Testing Phase 6: Document Export (PDF) ---");
        try {
            const pdfBuffer = await generateResumePDF(fakeResumeData);
            console.log(`✅ PDF Generated successfully! Size: ${pdfBuffer.length} bytes`);
        } catch (e) {
            console.error('❌ PDF Generation failed:', e.message);
        }
        console.log();

        // --- Phase 7: PostgreSQL Persistence ---
        console.log("--- Testing Phase 7: Resume Vault (PostgreSQL) ---");
        try {
            console.log("Attempting database connection...");
            await db.connectDB();

            const dbData = {
                jobTitle: 'Senior Full-Stack Developer',
                company: 'TechCorp',
                githubUsername: 'test-user-123',
                resumeJSON: fakeResumeData,
                tailoringBlueprint: blueprint,
                jobDescription: 'test jd'
            };
            const savedItem = await saveResume(dbData);
            console.log(`✅ Saved to DB Successfully! ID: ${savedItem.id}`);

            // Cleanup
            await db.query('DELETE FROM resumes WHERE id = $1', [savedItem.id]);
            console.log("✅ Cleaned up test data.");

            const pool = db.getPool();
            if (pool) {
                await pool.end();
            }
        } catch (e) {
            console.error('❌ DB connection or save failed:', e.message);
        }
        console.log();

        console.log("==================================================");
        console.log("🎉 ALL PHASE TESTS COMPLETED");
        console.log("==================================================");

    } catch (e) {
        console.error("❌ CRITICAL ERROR DURING TESTING:", e);
    }
}

testAllPhases();
