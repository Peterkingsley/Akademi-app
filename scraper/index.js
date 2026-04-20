const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const BASE_URL = 'https://myschool.ng';
const DELAY_MS = 1000;
const OUTPUT_FILE = 'nigerian_tertiary_master.json';
const SAMPLE_SIZE = Infinity;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function extractCode(text) {
    const parenRegex = /\(([^)]+)\)/;
    const parenMatch = text.match(parenRegex);
    if (parenMatch) {
        const code = parenMatch[1].trim();
        const name = text.replace(parenRegex, '').trim();
        return { name, code };
    }
    const codeRegex = /([A-Z]{2,4}(?:\s\d{3})?)$/;
    const codeMatch = text.match(codeRegex);
    if (codeMatch) {
        const code = codeMatch[1].trim();
        const name = text.replace(codeRegex, '').trim();
        return { name, code };
    }
    return { name: text.trim(), code: "N/A" };
}

async function fetchFacultyMap() {
    const facultyMap = {};
    try {
        const { data } = await axios.get(`${BASE_URL}/classroom/jamb-brochure`);
        const $ = cheerio.load(data);
        $('a[href*="/classroom/jamb-brochure/"]').each((i, el) => {
            const href = $(el).attr('href');
            const name = $(el).text().trim();
            const parts = href.split('/');
            if (parts.length >= 2) {
                const slug = parts[parts.length - 1];
                const type = parts[parts.length - 2];
                facultyMap[`${type}/${slug}`] = name;
            }
        });
    } catch (error) {
        console.error('Error fetching faculty map:', error.message);
    }
    return facultyMap;
}

async function scrapeInstitutions() {
    const institutions = [];
    try {
        const { data } = await axios.get(`${BASE_URL}/institutions`);
        const $ = cheerio.load(data);
        const categories = ['University', 'Polytechnic', 'College of Education'];
        categories.forEach(cat => {
            const header = $(`h3:contains("${cat}"), h5:contains("${cat}"), b:contains("${cat}")`).filter((i, el) => $(el).text().trim() === cat);
            let container = header.next('ul');
            if (container.length === 0) container = header.parent().find('ul');
            container.find('li a, a').each((i, el) => {
                const name = $(el).text().trim();
                const href = $(el).attr('href');
                if (href && href.includes('/institutions/')) {
                    const slug = href.split('/').pop();
                    if (slug && slug !== 'institutions') institutions.push({ name, type: cat, slug });
                }
            });
        });
        if (institutions.length === 0) {
            $('a[href*="/institutions/"]').each((i, el) => {
                const name = $(el).text().trim();
                const href = $(el).attr('href');
                const slug = href.split('/').pop();
                if (slug && slug !== 'institutions') institutions.push({ name, type: 'Institution', slug });
            });
        }
    } catch (error) {
        console.error('Error scraping institutions:', error.message);
    }
    return institutions.filter((v, i, a) => a.findIndex(t => t.slug === v.slug) === i);
}

async function scrapeCourses(institution, facultyMap) {
    const facultyGroups = {};
    try {
        const { data } = await axios.get(`${BASE_URL}/classroom/institution-courses/${institution.slug}`);
        const $ = cheerio.load(data);
        $('ul.vert-menu-list li a').each((i, el) => {
            const rawText = $(el).text().trim();
            const href = $(el).attr('href');
            const { name, code } = extractCode(rawText);
            const parts = href.split('/');
            if (parts.length >= 3) {
                const facultySlug = parts[parts.length - 2];
                const typeSlug = parts[parts.length - 3];
                const facultyKey = `${typeSlug}/${facultySlug}`;
                const facultyName = facultyMap[facultyKey] || facultySlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                if (!facultyGroups[facultyName]) facultyGroups[facultyName] = { faculty_name: facultyName, courses: [] };
                facultyGroups[facultyName].courses.push({ course_name: name, course_code: code });
            }
        });
    } catch (error) {
        // Silently skip errors for individual institutions
    }
    return Object.values(facultyGroups);
}

async function main() {
    try {
        const facultyMap = await fetchFacultyMap();
        const institutions = await scrapeInstitutions();
        const targetInstitutions = institutions.slice(0, SAMPLE_SIZE);
        const results = [];
        console.log(`Starting full scrape of ${targetInstitutions.length} institutions...`);
        for (let i = 0; i < targetInstitutions.length; i++) {
            const inst = targetInstitutions[i];
            const faculties = await scrapeCourses(inst, facultyMap);
            results.push({ institution: inst.name, type: inst.type, faculties });
            if ((i + 1) % 50 === 0 || i === targetInstitutions.length - 1) {
                fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
                console.log(`Progress: ${i+1}/${targetInstitutions.length} saved.`);
            }
            await sleep(DELAY_MS);
        }
        console.log('Full scrape completed.');
    } catch (error) {
        console.error('Fatal error:', error.stack);
    }
}
main();
