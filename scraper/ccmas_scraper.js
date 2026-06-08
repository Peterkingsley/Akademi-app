const fs = require('fs');
const axios = require('axios');
const pdf = require('pdf-parse');

const CCMAS_URLS = {
    "Administration and Management": "https://www.nuc.edu.ng/wp-content/uploads/2026/03/Administration-and-Management.pdf",
    "Agriculture": "https://www.nuc.edu.ng/wp-content/uploads/2026/03/Agriculture-2023.pdf",
    "Allied Health Sciences": "https://www.nuc.edu.ng/wp-content/uploads/2026/03/Allied-Health-Sciences-2023.pdf",
    "Architecture": "https://www.nuc.edu.ng/wp-content/uploads/2026/03/Architecture-CCMAS-2023-FINAL.pdf",
    "Arts": "https://www.nuc.edu.ng/wp-content/uploads/2026/03/Arts-CCMAS-2023-FINAL.pdf",
    "Basic Medical Sciences": "https://www.nuc.edu.ng/wp-content/uploads/2026/03/Basic-Medical-Sciences-CCMAS-FINAL-December-26-2022.pdf",
    "Communication and Media Studies": "https://www.nuc.edu.ng/wp-content/uploads/2026/03/Communication-and-Media-Studies-CCMAS-2023-FINAL.pdf",
    "Computing": "https://www.nuc.edu.ng/wp-content/uploads/2026/03/Computing-CCMAS-2023-FINAL.pdf",
    "Education": "https://www.nuc.edu.ng/wp-content/uploads/2026/03/Education-CCMAS-2023-New.pdf",
    "Engineering": "https://www.nuc.edu.ng/wp-content/uploads/2026/03/Engineering-Technology-CCMAS-2023-FINAL.pdf",
    "Environmental Sciences": "https://www.nuc.edu.ng/wp-content/uploads/2026/03/Environmental-Sciences-CCMAS-2023-FINAL.pdf",
    "Law": "https://www.nuc.edu.ng/wp-content/uploads/2026/03/Law-ALL.pdf",
    "Medicine and Dentistry": "https://www.nuc.edu.ng/wp-content/uploads/2026/03/Medicine-and-Dentistry-CCMAS-2023-FINAL.pdf",
    "Pharmacy and Pharmaceutical Sciences": "https://www.nuc.edu.ng/wp-content/uploads/2026/03/Pharmacy-and-Pharmaceutical-Sciences-CCMAS-2023-FINAL.pdf",
    "Sciences": "https://www.nuc.edu.ng/wp-content/uploads/2026/03/Sciences-CCMAS-2023-FINAL.pdf",
    "Social Sciences": "https://www.nuc.edu.ng/wp-content/uploads/2026/03/Social-Sciences-CCMAS-FINAL-2023-A.pdf",
    "Veterinary Medicine": "https://www.nuc.edu.ng/wp-content/uploads/2026/03/Veterinary-Medicine-CCMAS-2023-FINAL.pdf"
};

const DELAY_BETWEEN_DISCIPLINES = 2000;
const MAX_RETRIES = 3;

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            return await axios.get(url, {
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 30000
            });
        } catch (error) {
            console.warn(`Attempt ${i + 1} failed for ${url}: ${error.message}`);
            if (i === retries - 1) throw error;
            await sleep(Math.pow(2, i) * 2000); // Exponential backoff: 2s, 4s, 8s
        }
    }
}

async function downloadAndParse(discipline, url) {
    console.log(`Processing ${discipline}...`);
    try {
        const response = await fetchWithRetry(url);
        const data = await pdf(response.data);
        const text = data.text;

        const courses = [];
        const lines = text.split('\n');
        let currentLevel = 100;

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.includes('100 Level')) currentLevel = 100;
            else if (trimmedLine.includes('200 Level')) currentLevel = 200;
            else if (trimmedLine.includes('300 Level')) currentLevel = 300;
            else if (trimmedLine.includes('400 Level')) currentLevel = 400;
            else if (trimmedLine.includes('500 Level')) currentLevel = 500;
            else if (trimmedLine.includes('600 Level')) currentLevel = 600;

            // Updated Regex to be more flexible
            const courseMatch = trimmedLine.match(/^([A-Z]{3,4})\s?([0-9]{3})[:\s]+(.+?)\s+([0-9])\s+[CE]/i)
                             || trimmedLine.match(/^([A-Z]{3,4})\s?([0-9]{3})\s+(.+?)\s+([0-9])$/);

            if (courseMatch) {
                courses.push({
                    code: `${courseMatch[1].toUpperCase()} ${courseMatch[2]}`,
                    name: courseMatch[3].replace(/:/g, '').trim(),
                    units: parseInt(courseMatch[4]),
                    level: currentLevel
                });
            }
        }

        const uniqueCourses = [];
        const codes = new Set();
        for (const c of courses) {
            if (!codes.has(c.code)) {
                codes.add(c.code);
                uniqueCourses.push(c);
            }
        }

        console.log(`Found ${uniqueCourses.length} unique courses in ${discipline}.`);
        return uniqueCourses;
    } catch (error) {
        console.error(`Fatal error processing ${discipline}: ${error.message}`);
        return [];
    }
}

async function main() {
    const allResults = {};
    for (const [discipline, url] of Object.entries(CCMAS_URLS)) {
        allResults[discipline] = await downloadAndParse(discipline, url);
        await sleep(DELAY_BETWEEN_DISCIPLINES);
    }
    fs.writeFileSync('scraper/ccmas_courses.json', JSON.stringify(allResults, null, 2));
    console.log('CCMAS scraping complete.');
}

if (require.main === module) {
    main();
}
