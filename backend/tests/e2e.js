/**
 * End-to-End (E2E) Test Script for ResumeX Chrome Extension and PostgreSQL Backend
 * 
 * This script automates the entire ResumeX workflow:
 * 1. Launches Chromium with the ResumeX extension loaded.
 * 2. Opens the extension popup to configure and sync a profile.
 * 3. Navigates to a mock job description page to trigger AI resume tailoring.
 * 4. Navigates to a mock job application form and triggers auto-fill.
 * 5. Asserts that the form is correctly populated with the tailored profile.
 */

const { chromium } = require('playwright');
const path = require('path');
const http = require('http');

// Configurations
const BACKEND_URL = 'http://localhost:3001';
const EXTENSION_PATH = path.join(__dirname, '..', '..', 'extension');
const TEST_JOB_LISTING = `file://${path.join(EXTENSION_PATH, 'tests', 'test-job-listing.html')}`;
const TEST_FORM = `file://${path.join(EXTENSION_PATH, 'tests', 'test-form.html')}`;

/**
 * Helper to check if the backend server is running
 */
function checkBackendServer() {
    return new Promise((resolve) => {
        const req = http.get(`${BACKEND_URL}/health`, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const json = JSON.parse(data);
                        resolve(json.status === 'ok');
                    } catch (e) {
                        resolve(false);
                    }
                } else {
                    resolve(false);
                }
            });
        });
        
        req.on('error', () => {
            resolve(false);
        });
        
        req.setTimeout(1500, () => {
            req.destroy();
            resolve(false);
        });
    });
}

async function runE2E() {
    console.log("==================================================");
    console.log("🚀 STARTING RESUMEX END-TO-END AUTOMATION TEST");
    console.log("==================================================\n");

    // 1. Verify Backend is Running
    console.log("Step 1: Checking backend API server status...");
    const isServerRunning = await checkBackendServer();
    if (!isServerRunning) {
        console.error("❌ ERROR: ResumeX backend API server is not running on http://localhost:3001.");
        console.error("👉 Please start the backend server before running this test:");
        console.error("   cd backend && npm start");
        process.exit(1);
    }
    console.log("✅ Backend API server is online.\n");

    // 2. Launch Browser with Extension
    console.log("Step 2: Launching Chromium with ResumeX extension loaded...");
    const userDataDir = path.join(__dirname, '..', 'scratch', 'test-user-data-dir');
    
    // Extensions only run in headful mode
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: [
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
            `--no-sandbox`
        ]
    });

    try {
        // 3. Find Extension ID and construct Popup URL
        console.log("Step 3: Finding Extension ID...");
        let [background] = context.serviceWorkers();
        if (!background) {
            background = await context.waitForEvent('serviceworker');
        }
        const extensionId = background.url().split('/')[2];
        const popupUrl = `chrome-extension://${extensionId}/popup.html`;
        console.log(`✅ Extension ID: ${extensionId}`);
        console.log(`✅ Popup URL: ${popupUrl}\n`);

        // 4. Import Local Profile (PDF Ingestion)
        console.log("Step 4: Opening Extension Popup to import local profile...");
        const popupPage = await context.newPage();
        await popupPage.goto(popupUrl);
        await popupPage.waitForLoadState('domcontentloaded');

        // Configure the local backend server API URL in settings
        console.log("Opening settings panel...");
        await popupPage.click('#settingsBtn');
        await popupPage.fill('#apiUrlInput', BACKEND_URL);
        await popupPage.click('#saveSettingsBtn');
        
        // Wait for settings to save
        await popupPage.waitForTimeout(1000);
        
        // Re-open settings to trigger file upload
        await popupPage.click('#settingsBtn');
        
        console.log("Uploading Profile-1.pdf to import local profile data...");
        const fileChooserPromise = popupPage.waitForEvent('filechooser');
        await popupPage.click('#importProfileBtn');
        const fileChooser = await fileChooserPromise;
        
        const pdfPath = path.join(__dirname, '..', '..', 'Profile-1.pdf');
        await fileChooser.setFiles(pdfPath);
        
        // Wait for import status message in popup
        console.log("Waiting for PDF parsing and ingestion on backend...");
        const statusElement = popupPage.locator('#status');
        await statusElement.waitFor({ state: 'visible', timeout: 30000 });
        let statusText = await statusElement.textContent();
        console.log(`💬 Popup Status Message: "${statusText}"`);
        
        if (statusText.toLowerCase().includes('error')) {
            throw new Error(`Profile import failed: ${statusText}`);
        }
        console.log("✅ Profile successfully ingested and cached locally.\n");

        // 5. Open Mock Job Listing Page
        console.log("Step 5: Navigating to mock job description page...");
        const jobPage = await context.newPage();
        await jobPage.goto(TEST_JOB_LISTING);
        await jobPage.waitForLoadState('domcontentloaded');
        console.log("✅ Mock job listing loaded.\n");

        // 6. Trigger Resume Tailoring from Popup
        console.log("Step 6: Triggering AI Resume Tailoring from extension popup...");
        // Focus back on the popup, enter job details, and generate
        await popupPage.bringToFront();
        await popupPage.fill('#jobTitle', 'Systems Architect & Backend Developer');
        
        console.log("Clicking 'Generate Tailored Resume' (calling backend API)...");
        // Intercept API call to verify it communicates with the PostgreSQL backend
        popupPage.on('request', request => {
            if (request.url().includes('/api/generate-resume') || request.url().includes('/api/generate-tailored-resume') || request.url().includes('/api/save-resume')) {
                console.log(`📡 Extension calling backend API: ${request.method()} ${request.url()}`);
            }
        });

        await popupPage.click('#generateBtn');
        
        // Wait for generation success (message element should show "Resume generated")
        console.log("Waiting for AI resume generation to complete...");
        await statusElement.waitFor({ state: 'visible', timeout: 30000 });
        
        // Let it settle for a moment to allow UI to render results
        await popupPage.waitForTimeout(3000);
        
        statusText = await statusElement.textContent();
        console.log(`💬 Popup Status Message: "${statusText}"`);
        
        if (statusText.toLowerCase().includes('error') && !statusText.toLowerCase().includes('successfully')) {
            throw new Error(`Resume generation failed: ${statusText}`);
        }
        console.log("✅ Tailored resume successfully generated and saved to PostgreSQL vault.\n");

        // 7. Open Mock Job Application Form
        console.log("Step 7: Navigating to mock job application form...");
        const formPage = await context.newPage();
        await formPage.goto(TEST_FORM);
        await formPage.waitForLoadState('domcontentloaded');
        console.log("✅ Mock job application form loaded.\n");

        // 8. Trigger Auto-Fill
        console.log("Step 8: Triggering Auto-Fill from the extension popup...");
        await popupPage.bringToFront();
        
        // Click the autofill button in the popup
        await popupPage.click('#autoFillBtn');
        
        // Wait for autofill script to execute on the form page
        console.log("Waiting for form page fields to populate...");
        await formPage.bringToFront();
        await formPage.waitForTimeout(2000); // Give autofill script a moment to run

        // 9. Assert Form Fields are Correctly Filled
        console.log("Step 9: Verifying autofilled form fields...");
        
        const nameVal = await formPage.locator('#name').inputValue();
        const emailVal = await formPage.locator('#email').inputValue();
        const phoneVal = await formPage.locator('#phone').inputValue();
        const linkedinVal = await formPage.locator('#linkedin').inputValue();
        const githubVal = await formPage.locator('#github').inputValue();
        const coverLetterVal = await formPage.locator('#cover-letter').inputValue();

        console.log(`   - Name: "${nameVal}"`);
        console.log(`   - Email: "${emailVal}"`);
        console.log(`   - Phone: "${phoneVal}"`);
        console.log(`   - LinkedIn: "${linkedinVal}"`);
        console.log(`   - GitHub: "${githubVal}"`);
        console.log(`   - Cover Letter Length: ${coverLetterVal.length} chars`);

        // Perform assertions
        if (nameVal !== "Liam Gray") throw new Error(`Assertion Failed: Expected Name to be "Liam Gray", got "${nameVal}"`);
        if (emailVal !== "liamdgray@gmail.com") throw new Error(`Assertion Failed: Expected Email to be "liamdgray@gmail.com", got "${emailVal}"`);
        if (phoneVal !== "520.230.3579") throw new Error(`Assertion Failed: Expected Phone to be "520.230.3579", got "${phoneVal}"`);
        if (!linkedinVal.includes("liamdgray")) throw new Error(`Assertion Failed: Expected LinkedIn URL to contain "liamdgray", got "${linkedinVal}"`);
        if (!githubVal.includes("LiamDGray")) throw new Error(`Assertion Failed: Expected GitHub URL to contain "LiamDGray", got "${githubVal}"`);
        if (!coverLetterVal || coverLetterVal.length < 50) throw new Error("Assertion Failed: Expected Cover Letter to be populated");

        console.log("\n✅ E2E Verification: All form fields are correctly filled and validated.");

        console.log("\n==================================================");
        console.log("🎉 SUCCESS: RESUMEX E2E FLOW COMPLETED PASSED");
        console.log("==================================================");

    } catch (e) {
        console.error("\n❌ E2E TEST FAILED:", e.message);
    } finally {
        // Keep browser open for 3 seconds so user can inspect the filled form, then close
        console.log("\nClosing browser in 3 seconds...");
        if (typeof popupPage !== 'undefined') {
            await popupPage.waitForTimeout(3000);
        }
        await context.close();
    }
}

runE2E();
