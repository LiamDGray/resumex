/**
 * Popup Script - Main Extension UI Logic
 */

// DOM Elements
const jobTitleInput = document.getElementById('jobTitle');
const githubProfileInput = document.getElementById('githubProfile');
const linkedinProfileInput = document.getElementById('linkedinProfile');
const generateBtn = document.getElementById('generateBtn');
const extractBtn = document.getElementById('extractBtn');
const statusDiv = document.getElementById('status');
const resultsDiv = document.getElementById('results');
const actionButtonsDiv = document.getElementById('actionButtons');
const saveBtn = document.getElementById('saveBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const copyBtn = document.getElementById('copyBtn');
const autoFillSection = document.getElementById('autoFillSection');
const autoFillBtn = document.getElementById('autoFillBtn');
const autoFillStatus = document.getElementById('autoFillStatus');
const syncBtn = document.getElementById('syncBtn');
const syncStatus = document.getElementById('syncStatus');

// Settings Elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const apiUrlInput = document.getElementById('apiUrlInput');
const emailInput = document.getElementById('emailInput');
const phoneInput = document.getElementById('phoneInput');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const importProfileBtn = document.getElementById('importProfileBtn');
const profileFileInput = document.getElementById('profileFileInput');

// Default API URL (no user input needed)
const DEFAULT_API_URL = 'https://resumex-5ij7.onrender.com';

// Storage keys
const STORAGE_KEYS = {
    JOB_TITLE: 'jobTitle',
    GITHUB_PROFILE: 'githubProfile',
    LINKEDIN_PROFILE: 'linkedinProfile',
    API_URL: 'apiUrl',
    PERSONAL_INFO: 'personalInfo',
    CURRENT_RESUME_DATA: 'currentResumeData',
    CURRENT_JOB_DESCRIPTION: 'currentJobDescription',
    EMAIL: 'email',
    PHONE: 'phone'
};

// Global state
let currentResumeData = null;
let currentJobDescription = null;

/**
 * Get the API URL from storage or use default
 */
async function getApiUrl() {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.API_URL);
    return stored.apiUrl || DEFAULT_API_URL;
}

/**
 * Extract GitHub username from a profile link or raw username
 * e.g., "https://github.com/octocat" -> "octocat"
 */
function extractGithubUsername(input) {
    const trimmed = input.trim();
    // If it's a URL, extract the username
    const match = trimmed.match(/github\.com\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    // Otherwise treat as raw username
    return trimmed;
}

function updateSyncStatus(profile) {
    if (profile && profile.syncedAt) {
        const timeStr = new Date(profile.syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = new Date(profile.syncedAt).toLocaleDateString();
        syncStatus.textContent = `${dateStr} ${timeStr}`;
        syncStatus.style.color = '#28a745';
        syncStatus.style.fontWeight = 'bold';
    } else {
        syncStatus.textContent = 'Not Synced';
        syncStatus.style.color = '#dc3545';
        syncStatus.style.fontWeight = 'bold';
    }
}

function ensureAbsoluteUrl(url) {
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) {
        return 'https://' + url;
    }
    return url;
}

function ensureGithubUrl(input) {
    let url = input.trim();
    if (!url) return '';
    if (!url.includes('github.com')) {
        url = `github.com/${url}`;
    }
    return ensureAbsoluteUrl(url);
}

function ensureLinkedinUrl(input) {
    let url = input.trim();
    if (!url) return '';
    if (!url.includes('linkedin.com')) {
        url = `linkedin.com/in/${url}`;
    }
    return ensureAbsoluteUrl(url);
}

async function handleSyncProfile() {
    let githubProfile = githubProfileInput.value.trim();
    let linkedinProfile = linkedinProfileInput.value.trim();
    
    if (!githubProfile) {
        showStatus('Please enter your GitHub profile URL first.', 'error');
        return;
    }
    if (!linkedinProfile) {
        showStatus('Please enter your LinkedIn profile URL first.', 'error');
        return;
    }

    githubProfile = ensureGithubUrl(githubProfile);
    linkedinProfile = ensureLinkedinUrl(linkedinProfile);

    try {
        syncBtn.disabled = true;
        syncBtn.textContent = '🔄 Syncing...';
        showStatus('Syncing LinkedIn & GitHub profiles in background... Make sure you are logged into LinkedIn.', 'loading');
        
        chrome.runtime.sendMessage({
            action: 'sync_profile',
            linkedinUrl: linkedinProfile,
            githubUrl: githubProfile
        }, (response) => {
            syncBtn.disabled = false;
            syncBtn.textContent = '🔄 Sync';
            
            if (response && response.success) {
                updateSyncStatus(response.profile);
                showStatus('Profiles synced successfully! 🎉', 'success');
            } else {
                showStatus(response?.error || 'Sync failed. Please check your credentials/connection.', 'error');
            }
        });
    } catch (error) {
        console.error(error);
        syncBtn.disabled = false;
        syncBtn.textContent = '🔄 Sync';
        showStatus(`Error: ${error.message}`, 'error');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Load saved settings
    const saved = await chrome.storage.local.get([
        STORAGE_KEYS.JOB_TITLE,
        STORAGE_KEYS.GITHUB_PROFILE,
        STORAGE_KEYS.LINKEDIN_PROFILE,
        STORAGE_KEYS.API_URL,
        STORAGE_KEYS.CURRENT_RESUME_DATA,
        STORAGE_KEYS.CURRENT_JOB_DESCRIPTION,
        STORAGE_KEYS.EMAIL,
        STORAGE_KEYS.PHONE,
        'userProfile'
    ]);

    if (saved.jobTitle) jobTitleInput.value = saved.jobTitle;
    if (saved.githubProfile) githubProfileInput.value = saved.githubProfile;
    if (saved.linkedinProfile) linkedinProfileInput.value = saved.linkedinProfile;
    apiUrlInput.value = saved.apiUrl || DEFAULT_API_URL;
    if (saved.email) emailInput.value = saved.email;
    if (saved.phone) phoneInput.value = saved.phone;
    
    updateSyncStatus(saved.userProfile);

    // Restore active tailored resume state if available
    if (saved[STORAGE_KEYS.CURRENT_RESUME_DATA]) {
        currentResumeData = saved[STORAGE_KEYS.CURRENT_RESUME_DATA];
        currentJobDescription = saved[STORAGE_KEYS.CURRENT_JOB_DESCRIPTION] || null;
        displayResume(currentResumeData.resume, currentResumeData.tailoringData);
        showActionButtons();
        showAutoFillSection();
    }

    // Event listeners
    generateBtn.addEventListener('click', handleGenerateResume);
    saveBtn.addEventListener('click', handleSaveResume);
    downloadPdfBtn.addEventListener('click', handleDownloadPDF);
    copyBtn.addEventListener('click', handleCopyJson);
    autoFillBtn.addEventListener('click', handleAutoFill);
    syncBtn.addEventListener('click', handleSyncProfile);
    importProfileBtn.addEventListener('click', () => profileFileInput.click());
    profileFileInput.addEventListener('change', handleImportProfile);

    // Toggle settings panel
    settingsBtn.addEventListener('click', () => {
        const isHidden = settingsPanel.style.display === 'none';
        settingsPanel.style.display = isHidden ? 'block' : 'none';
    });

    // Save Settings
    saveSettingsBtn.addEventListener('click', async () => {
        const url = apiUrlInput.value.trim();
        const email = emailInput.value.trim();
        const phone = phoneInput.value.trim();
        
        await chrome.storage.local.set({
            [STORAGE_KEYS.API_URL]: url,
            [STORAGE_KEYS.EMAIL]: email,
            [STORAGE_KEYS.PHONE]: phone
        });
        
        saveSettingsBtn.textContent = '✓ Saved!';
        saveSettingsBtn.style.background = '#218838';
        
        setTimeout(() => {
            saveSettingsBtn.textContent = 'Save Settings';
            saveSettingsBtn.style.background = '#28a745';
            settingsPanel.style.display = 'none';
        }, 1500);
    });

    // Save settings on change
    jobTitleInput.addEventListener('change', () => {
        chrome.storage.local.set({ [STORAGE_KEYS.JOB_TITLE]: jobTitleInput.value });
    });
    githubProfileInput.addEventListener('change', () => {
        chrome.storage.local.set({ [STORAGE_KEYS.GITHUB_PROFILE]: githubProfileInput.value });
    });
    linkedinProfileInput.addEventListener('change', () => {
        chrome.storage.local.set({ [STORAGE_KEYS.LINKEDIN_PROFILE]: linkedinProfileInput.value });
    });
});

/**
 * Main function to generate tailored resume
 */
async function handleGenerateResume() {
    // Clear any previously cached cover letter or PDF bytes first
    await chrome.storage.local.remove(['coverLetter', 'pdfBytes', 'resumeFilename']);

    const githubProfile = githubProfileInput.value.trim();
    const githubUsername = extractGithubUsername(githubProfile);
    const apiUrl = await getApiUrl();

    // Validation
    if (!githubUsername) {
        showStatus('Please enter your GitHub profile link', 'error');
        return;
    }

    // Load user profile cache and personal contact info settings
    const stored = await chrome.storage.local.get(['userProfile', STORAGE_KEYS.EMAIL, STORAGE_KEYS.PHONE]);
    const userProfile = stored.userProfile;
    const customEmail = stored.email || '';
    const customPhone = stored.phone || '';

    if (!userProfile) {
        showStatus('No profile synced. Please click "🔄 Sync" first to load your credentials!', 'error');
        return;
    }

    // Merge custom email/phone from settings into userProfile personalInfo
    if (userProfile.personalInfo) {
        if (customEmail) userProfile.personalInfo.email = customEmail;
        if (customPhone) userProfile.personalInfo.phone = customPhone;
    }

    // Disable button
    generateBtn.disabled = true;
    showStatus('Extracting job description from page...', 'loading');
    hideResults();

    try {
        // Step 1: Get job description from current page
        const jobDescription = await extractJobDescription();

        if (!jobDescription || jobDescription.trim().length < 50) {
            showStatus('Could not extract job description. Make sure you are on a job posting page.', 'error');
            generateBtn.disabled = false;
            return;
        }

        showStatus('Sending request to backend API...', 'loading');

        // Step 2: Call backend API
        const response = await fetch(`${apiUrl}/api/generate-tailored-resume`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jobDescription,
                userProfile,
                githubUsername,
                linkedinProfile: linkedinProfileInput.value.trim()
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `API request failed with status ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Resume generation failed');
        }

        // Store data globally for save/download
        currentResumeData = {
            resume: data.resume,
            tailoringBlueprint: data.tailoringData?.blueprint || {},
            tailoringData: data.tailoringData
        };
        currentJobDescription = jobDescription;

        // If job title input is empty, fill it with the extracted role
        if (!jobTitleInput.value.trim() && data.tailoringData?.parsedJD?.role) {
            jobTitleInput.value = data.tailoringData.parsedJD.role;
            await chrome.storage.local.set({ [STORAGE_KEYS.JOB_TITLE]: data.tailoringData.parsedJD.role });
        }

        // Persist tailored resume state in storage to prevent reset on tab navigation/redirection
        await chrome.storage.local.set({
            [STORAGE_KEYS.CURRENT_RESUME_DATA]: currentResumeData,
            [STORAGE_KEYS.CURRENT_JOB_DESCRIPTION]: currentJobDescription
        });

        // Step 3: Display results
        showStatus('Resume generated successfully! 🎉', 'success');
        displayResume(data.resume, data.tailoringData);
        showActionButtons();
        showAutoFillSection();

        // Kick off pre-generation of cover letter and PDF in background
        preGenerateAssets(apiUrl);

    } catch (error) {
        console.error('Error:', error);
        showStatus(`Error: ${error.message}`, 'error');
    } finally {
        generateBtn.disabled = false;
    }
}

/**
 * Extract job description from current tab
 */
async function extractJobDescription() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: scrapeJobDescription
        });

        return results[0]?.result || '';
    } catch (error) {
        console.error('Error extracting job description:', error);
        throw new Error('Failed to extract job description from page');
    }
}

/**
 * Scraping function that runs in page context
 * This is injected into the page via content script
 */
function scrapeJobDescription() {
    // Remove script tags, style tags, and hidden elements
    const clonedBody = document.body.cloneNode(true);

    // Remove unwanted elements
    const unwantedSelectors = ['script', 'style', 'nav', 'header', 'footer', 'iframe', 'noscript'];
    unwantedSelectors.forEach(selector => {
        clonedBody.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Get visible text
    let text = clonedBody.innerText || clonedBody.textContent || '';

    // Clean up text
    text = text
        .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
        .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
        .trim();

    return text;
}

/**
 * Display resume in popup
 */
function displayResume(resume, tailoringData) {
    // Professional Summary
    document.getElementById('summary').textContent = resume.professionalSummary || 'N/A';

    // Skills
    const skillsDiv = document.getElementById('skills');
    skillsDiv.innerHTML = '';

    if (resume.skills) {
        const allSkills = [
            ...(resume.skills.technical || []),
            ...(resume.skills.tools || []),
            ...(resume.skills.soft || [])
        ];

        const skillTags = document.createElement('div');
        skillTags.className = 'skill-tags';

        allSkills.forEach(skill => {
            const tag = document.createElement('span');
            tag.className = 'skill-tag';
            tag.textContent = skill;
            skillTags.appendChild(tag);
        });

        skillsDiv.appendChild(skillTags);
    }

    // Projects
    const projectsDiv = document.getElementById('projects');
    projectsDiv.innerHTML = '';

    if (resume.projects && resume.projects.length > 0) {
        resume.projects.slice(0, 3).forEach(project => {
            const projectItem = document.createElement('div');
            projectItem.className = 'project-item';
            projectItem.innerHTML = `
                <strong>${project.name}</strong>
                <p style="margin-top: 5px; font-size: 12px; color: #666;">${project.description || ''}</p>
            `;
            projectsDiv.appendChild(projectItem);
        });
    } else {
        projectsDiv.textContent = 'No projects available';
    }

    // Tailoring Data
    const tailoringDiv = document.getElementById('tailoringData');
    tailoringDiv.innerHTML = '';

    if (tailoringData && tailoringData.blueprint) {
        const blueprint = tailoringData.blueprint;

        tailoringDiv.innerHTML = `
            <div class="tailoring-item">
                <strong>Matched Skills:</strong> ${blueprint.matchedSkills?.join(', ') || 'None'}
            </div>
            <div class="tailoring-item">
                <strong>Missing Skills:</strong> ${blueprint.missingSkills?.join(', ') || 'None'}
            </div>
            <div class="tailoring-item">
                <strong>Experience Match:</strong> ${blueprint.experienceMatchLevel || 'N/A'}
            </div>
            <div class="tailoring-item">
                <strong>Recommended Projects:</strong> ${blueprint.recommendedProjects?.join(', ') || 'None'}
            </div>
        `;
    }

    // Raw JSON
    document.getElementById('rawJson').textContent = JSON.stringify(resume, null, 2);

    // Show results
    showResults();
}

/**
 * Copy JSON to clipboard
 */
async function handleCopyJson() {
    const jsonText = document.getElementById('rawJson').textContent;

    try {
        await navigator.clipboard.writeText(jsonText);
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => {
            copyBtn.textContent = 'Copy Resume JSON';
        }, 2000);
    } catch (error) {
        console.error('Failed to copy:', error);
        showStatus('Failed to copy to clipboard', 'error');
    }
}

/**
 * Show status message
 */
function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.classList.remove('hidden');
}

/**
 * Show results section
 */
function showResults() {
    resultsDiv.classList.remove('hidden');
}

/**
 * Hide results section
 */
function hideResults() {
    resultsDiv.classList.add('hidden');
}

/**
 * Pre-generate and cache cover letter and PDF assets in the background to make auto-fill instant
 */
async function preGenerateAssets(apiUrl) {
    if (!currentResumeData || !currentJobDescription) return;

    let jobTitle = jobTitleInput.value.trim();
    if (!jobTitle) {
        if (currentResumeData.tailoringData?.parsedJD?.role) {
            jobTitle = currentResumeData.tailoringData.parsedJD.role;
        } else if (currentResumeData.resume?.experience?.[0]?.position) {
            jobTitle = currentResumeData.resume.experience[0].position;
        } else {
            jobTitle = 'Software Engineer';
        }
    }

    console.log('🚀 Pre-generating cover letter and PDF in background...');

    // 1. Pre-generate Cover Letter
    fetch(`${apiUrl}/api/generate-cover-letter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jobDescription: currentJobDescription,
            tailoringBlueprint: currentResumeData.tailoringBlueprint,
            resumeJSON: currentResumeData.resume,
            company: '',
            jobTitle
        })
    }).then(async (response) => {
        if (response.ok) {
            const clData = await response.json();
            await chrome.storage.local.set({ coverLetter: clData.coverLetter });
            console.log('✅ Pre-generated cover letter cached');
        }
    }).catch(err => console.warn('Pre-generating cover letter failed:', err));

    // 2. Pre-generate and fetch PDF
    const githubUsername = extractGithubUsername(githubProfileInput.value);
    fetch(`${apiUrl}/api/save-resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jobTitle: jobTitle || 'Tailored Resume',
            company: '',
            githubUsername,
            resumeJSON: currentResumeData.resume,
            tailoringBlueprint: currentResumeData.tailoringBlueprint,
            jobDescription: currentJobDescription
        })
    }).then(async (response) => {
        if (response.ok) {
            const saveData = await response.json();
            const resumeId = saveData.resume._id;
            return fetch(`${apiUrl}/api/resume/${resumeId}/pdf`);
        }
        throw new Error('Save resume failed during pre-generation');
    }).then(async (response) => {
        if (response.ok) {
            const pdfArrayBuffer = await response.arrayBuffer();
            const pdfBytes = Array.from(new Uint8Array(pdfArrayBuffer));
            const resumeFilename = `${(jobTitle || 'Tailored').replace(/\s+/g, '_')}_resume.pdf`;
            await chrome.storage.local.set({ pdfBytes, resumeFilename });
            console.log('✅ Pre-generated PDF bytes cached');
        }
    }).catch(err => console.warn('Pre-generating PDF failed:', err));
}

/**
 * Handle local profile file import (PDF, JSON, YAML, MD)
 */
async function handleImportProfile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const apiUrl = await getApiUrl();
    showStatus(`Reading file ${file.name}...`, 'loading');

    const reader = new FileReader();
    
    reader.onload = async () => {
        try {
            // Get base64 string
            const base64Content = reader.result.split(',')[1];
            
            showStatus('Parsing profile on backend...', 'loading');
            
            const response = await fetch(`${apiUrl}/api/ingest-profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fileContent: base64Content,
                    fileName: file.name,
                    fileType: file.type
                })
            });
            
            const result = await response.json();
            
            if (result.success && result.profile) {
                // Add syncedAt timestamp to simulate a sync
                result.profile.syncedAt = new Date().toISOString();
                
                // Save to local storage
                await chrome.storage.local.set({
                    userProfile: result.profile
                });
                
                // Update UI
                updateSyncStatus(result.profile);
                
                // Pre-fill GitHub/LinkedIn inputs if present in the imported profile
                if (result.profile.personalInfo) {
                    if (result.profile.personalInfo.github) {
                        githubProfileInput.value = result.profile.personalInfo.github;
                        chrome.storage.local.set({ [STORAGE_KEYS.GITHUB_PROFILE]: result.profile.personalInfo.github });
                    }
                    if (result.profile.personalInfo.linkedin) {
                        linkedinProfileInput.value = result.profile.personalInfo.linkedin;
                        chrome.storage.local.set({ [STORAGE_KEYS.LINKEDIN_PROFILE]: result.profile.personalInfo.linkedin });
                    }
                }
                
                showStatus(`Successfully imported profile: ${result.profile.personalInfo.name || 'User'} 🎉`, 'success');
                settingsPanel.style.display = 'none'; // hide settings panel
            } else {
                showStatus(result.error || 'Failed to parse the profile file.', 'error');
            }
        } catch (error) {
            console.error('Error importing profile:', error);
            showStatus(`Import error: ${error.message}`, 'error');
        }
    };
    
    reader.onerror = () => {
        showStatus('Failed to read local file.', 'error');
    };
    
    // Read as Data URL to get base64
    reader.readAsDataURL(file);
    
    // Reset file input value so same file can be selected again
    event.target.value = '';
}
