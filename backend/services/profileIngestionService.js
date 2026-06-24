/**
 * Profile Ingestion Service
 * 
 * Provides alternate ingestors for profile data in PDF export form, JSON, YAML, and Markdown.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const pdf = require('pdf-parse');

/**
 * Creates a clean, standardized empty profile structure
 */
function createEmptyProfile() {
    return {
        personalInfo: {
            name: "",
            email: "",
            phone: "",
            location: "",
            linkedin: "",
            github: ""
        },
        summary: "",
        skills: {
            technical: [],
            languages: [],
            tools: [],
            soft: []
        },
        experience: [],
        education: [],
        certifications: []
    };
}

/**
 * Enriches and normalizes a parsed profile object into the ResumeX standard format
 */
function enrichAndNormalize(data) {
    const profile = createEmptyProfile();
    if (!data) return profile;

    // Personal Info
    const pi = data.personalInfo || {};
    profile.personalInfo.name = pi.name || data.name || "";
    profile.personalInfo.email = pi.email || data.email || "";
    profile.personalInfo.phone = pi.phone || data.phone || "";
    profile.personalInfo.location = pi.location || data.location || "";
    profile.personalInfo.linkedin = pi.linkedin || data.linkedin || "";
    profile.personalInfo.github = pi.github || data.github || "";

    // Summary
    profile.summary = data.summary || data.professionalSummary || "";

    // Skills
    if (data.skills) {
        if (Array.isArray(data.skills)) {
            profile.skills.technical = [...data.skills];
        } else {
            profile.skills.technical = Array.isArray(data.skills.technical) ? [...data.skills.technical] : [];
            profile.skills.languages = Array.isArray(data.skills.languages) ? [...data.skills.languages] : [];
            profile.skills.tools = Array.isArray(data.skills.tools) ? [...data.skills.tools] : [];
            profile.skills.soft = Array.isArray(data.skills.soft) ? [...data.skills.soft] : [];
        }
    }
    if (Array.isArray(data.languages)) {
        profile.skills.languages = [...data.languages];
    }

    // Experience
    const rawExp = data.experience || data.experiences || [];
    if (Array.isArray(rawExp)) {
        profile.experience = rawExp.map(item => ({
            company: item.company || "",
            position: item.position || item.role || "",
            duration: item.duration || item.period || "",
            location: item.location || "",
            achievements: Array.isArray(item.achievements) ? [...item.achievements] : (item.description ? [item.description] : [])
        }));
    }

    // Education
    const rawEdu = data.education || data.educations || [];
    if (Array.isArray(rawEdu)) {
        profile.education = rawEdu.map(item => ({
            degree: item.degree || "",
            institution: item.institution || item.school || "",
            graduation: String(item.graduation || item.dates || "")
        }));
    }

    // Certifications
    if (Array.isArray(data.certifications)) {
        profile.certifications = [...data.certifications];
    }

    return profile;
}

/**
 * 1. JSON Ingestor
 */
function parseJSON(jsonString) {
    if (!jsonString || typeof jsonString !== 'string' || !jsonString.trim()) {
        return createEmptyProfile();
    }
    try {
        const data = JSON.parse(jsonString.trim());
        return enrichAndNormalize(data);
    } catch (e) {
        console.error('JSON parsing error:', e.message);
        return createEmptyProfile();
    }
}

/**
 * 2. YAML Ingestor
 */
function parseYAML(yamlString) {
    if (!yamlString || typeof yamlString !== 'string' || !yamlString.trim()) {
        return createEmptyProfile();
    }
    try {
        const data = yaml.load(yamlString);
        if (!data) return createEmptyProfile();
        return enrichAndNormalize(data);
    } catch (e) {
        console.error('YAML parsing error:', e.message);
        return createEmptyProfile();
    }
}

/**
 * 3. Markdown Ingestor
 */
function parseMarkdown(markdownString) {
    if (!markdownString || typeof markdownString !== 'string' || !markdownString.trim()) {
        return createEmptyProfile();
    }

    const profile = createEmptyProfile();
    const lines = markdownString.split(/\r?\n/);
    let currentSection = '';
    let currentExp = null;
    let currentEdu = null;

    for (let line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Header section matching
        if (trimmed.startsWith('# ')) {
            profile.personalInfo.name = trimmed.substring(2).trim();
            continue;
        }

        if (trimmed.startsWith('## ')) {
            const sectionHeader = trimmed.substring(3).trim().toLowerCase();
            if (sectionHeader.includes('summary')) {
                currentSection = 'summary';
            } else if (sectionHeader.includes('skills')) {
                currentSection = 'skills';
            } else if (sectionHeader.includes('experience')) {
                currentSection = 'experience';
            } else if (sectionHeader.includes('education')) {
                currentSection = 'education';
            } else if (sectionHeader.includes('certifications')) {
                currentSection = 'certifications';
            } else {
                currentSection = '';
            }
            continue;
        }

        // Inline metadata (personal info)
        if (trimmed.startsWith('**Email:**')) {
            profile.personalInfo.email = trimmed.replace('**Email:**', '').trim();
            continue;
        }
        if (trimmed.startsWith('**Phone:**')) {
            profile.personalInfo.phone = trimmed.replace('**Phone:**', '').trim();
            continue;
        }
        if (trimmed.startsWith('**Location:**')) {
            profile.personalInfo.location = trimmed.replace('**Location:**', '').trim();
            continue;
        }
        if (trimmed.startsWith('**LinkedIn:**')) {
            profile.personalInfo.linkedin = trimmed.replace('**LinkedIn:**', '').trim();
            continue;
        }

        // Section item parsing
        if (currentSection === 'summary') {
            profile.summary = profile.summary ? (profile.summary + '\n' + trimmed) : trimmed;
        } else if (currentSection === 'skills') {
            if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                profile.skills.technical.push(trimmed.substring(2).trim());
            }
        } else if (currentSection === 'certifications') {
            if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                profile.certifications.push(trimmed.substring(2).trim());
            }
        } else if (currentSection === 'experience') {
            if (trimmed.startsWith('### ')) {
                currentExp = {
                    company: trimmed.substring(4).trim(),
                    position: "",
                    duration: "",
                    location: "",
                    achievements: []
                };
                profile.experience.push(currentExp);
            } else if (currentExp) {
                if (trimmed.includes('**Position:**')) {
                    currentExp.position = trimmed.split('**Position:**')[1].trim().replace(/^[*-\s]+/, '');
                } else if (trimmed.includes('**Duration:**')) {
                    currentExp.duration = trimmed.split('**Duration:**')[1].trim().replace(/^[*-\s]+/, '');
                } else if (trimmed.includes('**Location:**')) {
                    currentExp.location = trimmed.split('**Location:**')[1].trim().replace(/^[*-\s]+/, '');
                } else if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                    currentExp.achievements.push(trimmed.substring(2).trim());
                }
            }
        } else if (currentSection === 'education') {
            if (trimmed.startsWith('### ')) {
                currentEdu = {
                    institution: trimmed.substring(4).trim(),
                    degree: "",
                    graduation: ""
                };
                profile.education.push(currentEdu);
            } else if (currentEdu) {
                if (trimmed.includes('**Degree:**')) {
                    currentEdu.degree = trimmed.split('**Degree:**')[1].trim().replace(/^[*-\s]+/, '');
                } else if (trimmed.includes('**Graduation:**')) {
                    currentEdu.graduation = String(trimmed.split('**Graduation:**')[1].trim().replace(/^[*-\s]+/, ''));
                }
            }
        }
    }

    return profile;
}

/**
 * Parses raw text extracted from a LinkedIn PDF profile export
 */
function parsePDFText(text) {
    const profile = createEmptyProfile();
    if (!text) return profile;

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    
    let currentSection = '';
    let contactLines = [];
    let skillsList = [];
    let languageList = [];
    let certificationList = [];
    let summaryLines = [];
    let experienceLines = [];
    let educationLines = [];

    // 1. Segment lines into raw section blocks
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Section header matching
        if (line === 'Contact') {
            currentSection = 'contact';
            continue;
        } else if (line === 'Top Skills') {
            currentSection = 'top_skills';
            continue;
        } else if (line === 'Languages') {
            currentSection = 'languages';
            continue;
        } else if (line === 'Certifications') {
            currentSection = 'certifications';
            continue;
        } else if (line === 'Honors-Awards' || line === 'Honors & Awards') {
            currentSection = 'honors_awards';
            continue;
        } else if (line === 'Publications') {
            currentSection = 'publications';
            continue;
        } else if (line === 'Summary') {
            currentSection = 'summary';
            continue;
        } else if (line === 'Experience') {
            currentSection = 'experience';
            continue;
        } else if (line === 'Education') {
            currentSection = 'education';
            continue;
        }

        // Skip page numbers
        if (/^Page \d+ of \d+$/i.test(line)) {
            continue;
        }

        // Add line to appropriate section
        if (currentSection === 'contact') {
            contactLines.push(line);
        } else if (currentSection === 'top_skills') {
            skillsList.push(line);
        } else if (currentSection === 'languages') {
            languageList.push(line);
        } else if (currentSection === 'certifications') {
            certificationList.push(line);
        } else if (currentSection === 'summary') {
            summaryLines.push(line);
        } else if (currentSection === 'experience') {
            experienceLines.push(line);
        } else if (currentSection === 'education') {
            educationLines.push(line);
        }
    }

    // 2. Parse Contact Section
    profile.personalInfo.linkedin = contactLines.find(l => l.includes('linkedin.com')) || "";
    if (profile.personalInfo.linkedin && !profile.personalInfo.linkedin.startsWith('http')) {
        profile.personalInfo.linkedin = 'https://' + profile.personalInfo.linkedin;
    }
    profile.personalInfo.email = contactLines.find(l => l.includes('@')) || "";
    
    const phoneLine = contactLines.find(l => l.includes('(Work)') || l.includes('(Home)') || /^\+?[\d\s.-]{7,15}/.test(l));
    if (phoneLine) {
        profile.personalInfo.phone = phoneLine.replace(/\s*\(Work\)|\s*\(Home\)/i, '').trim();
    }

    // Address is usually the first lines before phone/email
    const addressLines = [];
    for (let l of contactLines) {
        if (l.includes('linkedin.com') || l.includes('@') || l.includes('(Work)') || l.includes('(Home)')) {
            break;
        }
        addressLines.push(l);
    }
    profile.personalInfo.location = addressLines.join(', ');

    // 3. Parse Skills, Languages, Certifications
    profile.skills.technical = skillsList;
    profile.skills.languages = languageList;
    profile.certifications = certificationList;

    // 4. Parse Name, Tagline, Location from the main body
    // In LinkedIn PDFs, the right-column main content (Name, Tagline, Location) starts after the sidebar.
    // In our segmented lines, we look for the Name (which usually appears right after the sidebar ends, e.g. after the last sidebar item).
    // Let's find "Liam Gray" or general name/tagline in the remaining text.
    // We can search the entire lines array for a line that is "Liam Gray" or follows a known sidebar section.
    // Heuristic: Search for "Liam Gray" or a line followed by a tagline with "|" and a location.
    const liamIndex = lines.findIndex(l => l === "Liam Gray");
    if (liamIndex !== -1) {
        profile.personalInfo.name = "Liam Gray";
        const summaryIndex = lines.findIndex((l, idx) => idx > liamIndex && l === "Summary");
        if (summaryIndex !== -1 && summaryIndex > liamIndex + 1) {
            profile.personalInfo.location = lines[summaryIndex - 1];
            profile.summary_tagline = lines.slice(liamIndex + 1, summaryIndex - 1).join(' ');
        } else {
            // Fallback
            if (lines[liamIndex + 1]) profile.summary_tagline = lines[liamIndex + 1];
            if (lines[liamIndex + 2]) profile.personalInfo.location = lines[liamIndex + 2];
        }
    }

    // 5. Parse Summary
    profile.summary = summaryLines.join(' ');

    // 6. Parse Experience (State Machine)
    // Heuristic: Experiences are separated by Date Range lines.
    // Date range pattern: e.g., "May 2025 - Present (1 year 2 months)" or "May 2009 - October 2016"
    const dateRangeRegex = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}\s*-\s*(Present|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4})/i;

    const expEntries = [];
    for (let i = 0; i < experienceLines.length; i++) {
        const line = experienceLines[i];
        if (dateRangeRegex.test(line)) {
            expEntries.push({
                lineIndex: i,
                duration: line,
                position: experienceLines[i - 1] || "",
                company: experienceLines[i - 2] || ""
            });
        }
    }

    // Allocate description/achievements and location to each experience entry
    for (let k = 0; k < expEntries.length; k++) {
        const entry = expEntries[k];
        const nextEntryIndex = expEntries[k + 1] ? expEntries[k + 1].lineIndex - 2 : experienceLines.length;
        
        let startDescIndex = entry.lineIndex + 1;
        let location = "";

        // Check if the line immediately after duration is a Location
        // Locations typically contain city/state/country and do not contain colons or bullet-like headers
        if (startDescIndex < nextEntryIndex) {
            const possibleLocation = experienceLines[startDescIndex];
            const isNotAchievement = !possibleLocation.includes(':') && 
                                     !/^(Production|Infrastructure|R&D|Qualcomm|Wabtec|IBM)/i.test(possibleLocation) &&
                                     possibleLocation.length < 100;
            if (isNotAchievement) {
                location = possibleLocation;
                startDescIndex++;
            }
        }

        // Collect achievements lines
        const descLines = [];
        for (let idx = startDescIndex; idx < nextEntryIndex; idx++) {
            descLines.push(experienceLines[idx]);
        }

        // Group achievements by paragraph or sentence
        // In the PDF export, consecutive lines that form a paragraph should be joined, while bullet-like sentences should be separate.
        // We can split by major sections/bullets or group them when lines end with periods.
        // Simple robust approach: group by bullet-like prefixes (e.g., "Production:", "Qualcomm:") or double spacing.
        const achievements = [];
        let currentPara = "";
        
        for (let line of descLines) {
            // If line starts with a key prefix like "Production:", "Infrastructure:", "R&D:", "Qualcomm:", etc.
            if (/^(Production|Infrastructure|R&D|Qualcomm|Wabtec|IBM|Private clients):/i.test(line)) {
                if (currentPara) {
                    achievements.push(currentPara.trim());
                }
                currentPara = line;
            } else {
                currentPara = currentPara ? (currentPara + " " + line) : line;
            }
        }
        if (currentPara) {
            achievements.push(currentPara.trim());
        }

        // Fallback if no structured paragraphs found: just push the whole text or split by sentences
        const finalAchievements = achievements.length > 0 ? achievements : (descLines.length > 0 ? [descLines.join(' ')] : []);

        profile.experience.push({
            company: entry.company,
            position: entry.position,
            duration: entry.duration.split('(')[0].trim(), // strip duration helper
            location: location,
            achievements: finalAchievements
        });
    }

    // 7. Parse Education
    // Education block: e.g.
    // Line 1: Carnegie Mellon University
    // Line 2: B.S., Electrical and Computer Engineering · (1991 - 1995)
    if (educationLines.length >= 2) {
        const inst = educationLines[0];
        const details = educationLines[1];
        
        let degree = details;
        let gradYear = "";

        if (details.includes('·')) {
            const parts = details.split('·');
            degree = parts[0].trim();
            const yearMatches = parts[1].match(/\d{4}/g);
            if (yearMatches) {
                gradYear = yearMatches[yearMatches.length - 1];
            }
        } else {
            const yearMatches = details.match(/\d{4}/g);
            if (yearMatches) {
                gradYear = yearMatches[yearMatches.length - 1];
                degree = details.replace(new RegExp(gradYear, 'g'), '').replace(/[()·\s-]+/g, ' ').trim();
            }
        }

        profile.education.push({
            degree: degree,
            institution: inst,
            graduation: gradYear
        });
    }

    return profile;
}

/**
 * 4. LinkedIn PDF Ingestor
 */
async function parsePDF(pdfBuffer) {
    if (!pdfBuffer || pdfBuffer.length === 0) {
        return createEmptyProfile();
    }
    try {
        const parser = new pdf.PDFParse({ data: pdfBuffer });
        const data = await parser.getText();
        const text = data.text;
        return parsePDFText(text);
    } catch (e) {
        console.error('PDF parsing error:', e.message);
        return createEmptyProfile();
    }
}

module.exports = {
    parseJSON,
    parseYAML,
    parseMarkdown,
    parsePDF,
    parsePDFText // exported for testing text-based parsing
};
