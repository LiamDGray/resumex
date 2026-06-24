/**
 * Test suite for Profile Ingestion Service
 */

const fs = require('fs');
const path = require('path');
const { 
    parseJSON, 
    parseYAML, 
    parseMarkdown, 
    parsePDF 
} = require('../services/profileIngestionService');

describe('Profile Ingestion Service - TDD', () => {

    // 1. JSON Ingestor Tests
    describe('JSON Ingestor', () => {
        it('should correctly parse a valid JSON profile', () => {
            const jsonProfile = {
                personalInfo: {
                    name: "Liam Gray",
                    email: "liamdgray@gmail.com",
                    phone: "520.230.3579",
                    location: "Tucson, AZ",
                    linkedin: "https://www.linkedin.com/in/liamdgray"
                },
                summary: "Systems Architect and Backend Developer.",
                skills: {
                    technical: ["Distributed Systems", "OAuth", "REST APIs"]
                },
                experience: [
                    {
                        company: "FunnelHarbor LLC",
                        position: "Independent Systems Architect",
                        duration: "May 2025 - Present",
                        location: "Tucson, AZ",
                        achievements: ["Designed and deployed an asynchronous processing pipeline."]
                    }
                ],
                education: [
                    {
                        degree: "B.S. in Electrical & Computer Engineering",
                        institution: "Carnegie Mellon University",
                        graduation: "1995"
                    }
                ]
            };

            const result = parseJSON(JSON.stringify(jsonProfile));

            expect(result.personalInfo.name).toBe("Liam Gray");
            expect(result.personalInfo.email).toBe("liamdgray@gmail.com");
            expect(result.skills.technical).toContain("OAuth");
            expect(result.experience[0].company).toBe("FunnelHarbor LLC");
            expect(result.education[0].graduation).toBe("1995");
        });

        it('should return empty profile structure on invalid/empty JSON', () => {
            const result = parseJSON("");
            expect(result.personalInfo.name).toBe("");
            expect(result.experience).toEqual([]);
        });
    });

    // 2. YAML Ingestor Tests
    describe('YAML Ingestor', () => {
        it('should correctly parse a valid YAML profile', () => {
            const yamlString = `
personalInfo:
  name: Liam Gray
  email: liamdgray@gmail.com
  phone: 520.230.3579
  location: Tucson, AZ
  linkedin: https://www.linkedin.com/in/liamdgray
summary: Systems Architect and Backend Developer.
skills:
  technical:
    - Distributed Systems
    - OAuth
    - REST APIs
experience:
  - company: FunnelHarbor LLC
    position: Independent Systems Architect
    duration: May 2025 - Present
    location: Tucson, AZ
    achievements:
      - Designed and deployed an asynchronous processing pipeline.
education:
  - degree: B.S. in Electrical & Computer Engineering
    institution: Carnegie Mellon University
    graduation: "1995"
`;

            const result = parseYAML(yamlString);

            expect(result.personalInfo.name).toBe("Liam Gray");
            expect(result.personalInfo.email).toBe("liamdgray@gmail.com");
            expect(result.skills.technical).toContain("OAuth");
            expect(result.experience[0].company).toBe("FunnelHarbor LLC");
            expect(result.education[0].graduation).toBe("1995");
        });

        it('should return empty profile structure on invalid/empty YAML', () => {
            const result = parseYAML("");
            expect(result.personalInfo.name).toBe("");
            expect(result.experience).toEqual([]);
        });
    });

    // 3. Markdown Ingestor Tests
    describe('Markdown Ingestor', () => {
        it('should correctly parse a Markdown profile', () => {
            const markdownString = `
# Liam Gray
**Tagline:** Systems Architect | Backend Developer
**Email:** liamdgray@gmail.com
**Phone:** 520.230.3579
**Location:** Tucson, AZ
**LinkedIn:** https://www.linkedin.com/in/liamdgray

## Summary
Systems Architect and Backend Developer.

## Skills
* Distributed Systems
* OAuth
* REST APIs

## Experience
### FunnelHarbor LLC
* **Position:** Independent Systems Architect
* **Duration:** May 2025 - Present
* **Location:** Tucson, AZ
* Designed and deployed an asynchronous processing pipeline.
* Developed Cloudflare tunnels.

### Self-employed
* **Position:** Senior Software & Automation Engineer
* **Duration:** May 2009 - October 2016
* Provided integrated technical solutions.

## Education
### Carnegie Mellon University
* **Degree:** B.S. in Electrical & Computer Engineering
* **Graduation:** 1995
`;

            const result = parseMarkdown(markdownString);

            expect(result.personalInfo.name).toBe("Liam Gray");
            expect(result.personalInfo.email).toBe("liamdgray@gmail.com");
            expect(result.skills.technical).toContain("OAuth");
            expect(result.experience[0].company).toBe("FunnelHarbor LLC");
            expect(result.experience[0].position).toBe("Independent Systems Architect");
            expect(result.experience[0].duration).toBe("May 2025 - Present");
            expect(result.experience[0].achievements).toContain("Designed and deployed an asynchronous processing pipeline.");
            expect(result.experience[1].company).toBe("Self-employed");
            expect(result.education[0].institution).toBe("Carnegie Mellon University");
            expect(result.education[0].graduation).toBe("1995");
        });

        it('should return empty profile structure on invalid/empty Markdown', () => {
            const result = parseMarkdown("");
            expect(result.personalInfo.name).toBe("");
            expect(result.experience).toEqual([]);
        });
    });

    // 4. LinkedIn PDF Ingestor Tests
    describe('LinkedIn PDF Ingestor', () => {
        it('should correctly parse the actual Profile-1.pdf file', async () => {
            const pdfPath = path.join(__dirname, '..', '..', 'Profile-1.pdf');
            expect(fs.existsSync(pdfPath)).toBe(true);

            const pdfBuffer = fs.readFileSync(pdfPath);
            const result = await parsePDF(pdfBuffer);

            // Personal Info
            expect(result.personalInfo.name).toBe("Liam Gray");
            expect(result.personalInfo.email).toBe("liamdgray@gmail.com");
            expect(result.personalInfo.phone).toBe("520.230.3579");
            expect(result.personalInfo.linkedin).toContain("linkedin.com/in/liamdgray");
            expect(result.personalInfo.location).toBe("Tucson, Arizona, United States");

            // Summary
            expect(result.summary).toContain("Systems Architect with a B.S. in Electrical &amp; Computer Engineering");

            // Skills
            expect(result.skills.technical).toContain("Distributed Systems");
            expect(result.skills.technical).toContain("OAuth");
            expect(result.skills.technical).toContain("REST APIs");

            // Languages
            expect(result.skills.languages).toContain("Spanish (Elementary)");
            expect(result.skills.languages).toContain("English (Native or Bilingual)");

            // Certifications
            expect(result.certifications).toContain("The Data Scientist’s Toolbox");
            expect(result.certifications).toContain("R Programming");

            // Experience
            expect(result.experience.length).toBeGreaterThanOrEqual(3);
            
            const fh = result.experience.find(exp => exp.company === "FunnelHarbor LLC");
            expect(fh).toBeDefined();
            expect(fh.position).toBe("Independent Systems Architect");
            expect(fh.duration).toContain("May 2025");
            expect(fh.achievements.length).toBeGreaterThanOrEqual(2);
            expect(fh.achievements[0]).toContain("Designed and deployed");

            const se = result.experience.find(exp => exp.company === "Self-employed");
            expect(se).toBeDefined();
            expect(se.position).toBe("Senior Software & Automation Engineer");
            expect(se.duration).toContain("May 2009");

            const cr = result.experience.find(exp => exp.company === "Career Retrospective");
            expect(cr).toBeDefined();
            expect(cr.position).toBe("Systems Architecture & Embedded Engineering");
            expect(cr.duration).toContain("May 1992");

            // Education
            expect(result.education.length).toBe(1);
            expect(result.education[0].institution).toBe("Carnegie Mellon University");
            expect(result.education[0].degree).toContain("Electrical and Computer Engineering");
            expect(result.education[0].graduation).toBe("1995");
        });

        it('should return empty profile structure on invalid/empty PDF buffer', async () => {
            const result = await parsePDF(Buffer.from([]));
            expect(result.personalInfo.name).toBe("");
            expect(result.experience).toEqual([]);
        });
    });
});
