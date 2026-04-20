const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

/**
 * CONFIGURATION
 */
const BASE_URL = 'https://myschool.ng';
const DELAY_MS = 2000;
const OUTPUT_FILE = 'nigerian_tertiary_master.json';
const SAMPLE_SIZE = 3; // Change to Infinity for full scrape

/**
 * UTILS
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * extractCode(text)
 * Uses regex to find patterns like ([A-Z]{3} \d{3}) or simple initials in brackets.
 * Returns { name, code }.
 */
function extractCode(text) {
    // Pattern 1: Content inside parentheses (e.g., "Computer Science (CSC)")
    const parenRegex = /\(([^)]+)\)/;
    const parenMatch = text.match(parenRegex);
    if (parenMatch) {
        const code = parenMatch[1].trim();
        const name = text.replace(parenRegex, '').trim();
        return { name, code };
    }

    // Pattern 2: Alphanumeric code like "MTH 111" or "CSC" at the end of string
    // This looks for 2-4 uppercase letters followed by optional space and 3 digits
    const codeRegex = /([A-Z]{2,4}(?:\s\d{3})?)$/;
    const codeMatch = text.match(codeRegex);
    if (codeMatch) {
        const code = codeMatch[1].trim();
        const name = text.replace(codeRegex, '').trim();
        return { name, code };
    }

    // Default if no code found
    return { name: text.trim(), code: "N/A" };
}

/**
 * fetchFacultyMap()
 * Scrapes the brochure index to map URL paths to human-readable faculty names.
 */
async function fetchFacultyMap() {
    console.log('Fetching faculty names from brochure index...');
    const facultyMap = {};
    try {
        const { data } = await axios.get(`${BASE_URL}/classroom/jamb-brochure`);
        const $ = cheerio.load(data);

        $('a[href*="/classroom/jamb-brochure/"]').each((i, el) => {
            const href = $(el).attr('href');
            const name = $(el).text().trim();
            // href format: .../classroom/jamb-brochure/[type]/[faculty-slug]
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

/**
 * scrapeInstitutions()
 * Crawls the main institutions page to get slugs, names and types.
 */
async function scrapeInstitutions() {
    console.log('Scraping institutions index...');
    const institutions = [];
    try {
        const { data } = await axios.get(`${BASE_URL}/institutions`);
        const $ = cheerio.load(data);

        // Find headers (University, Polytechnic, etc.) and their following links
        const categories = ['University', 'Polytechnic', 'College of Education'];

        categories.forEach(cat => {
            // Find the text within the page that matches the category
            const header = $(`h3:contains("${cat}"), h5:contains("${cat}"), b:contains("${cat}")`).filter((i, el) => $(el).text().trim() === cat);

            // In the provided text view, links were listed under these headers.
            // Based on structure, they are often in the next ul or a div.
            let container = header.next('ul');
            if (container.length === 0) {
                container = header.parent().find('ul'); // try parent's ul
            }

            container.find('li a, a').each((i, el) => {
                const name = $(el).text().trim();
                const href = $(el).attr('href');
                if (href && href.includes('/institutions/')) {
                    const slug = href.split('/').pop();
                    if (slug && slug !== 'institutions') {
                        institutions.push({ name, type: cat, slug });
                    }
                }
            });
        });

        // Fallback: If above logic failed due to DOM changes, just grab all institution links
        if (institutions.length === 0) {
            $('a[href*="/institutions/"]').each((i, el) => {
                const name = $(el).text().trim();
                const href = $(el).attr('href');
                const slug = href.split('/').pop();
                if (slug && slug !== 'institutions') {
                    institutions.push({ name, type: 'Institution', slug });
                }
            });
        }
    } catch (error) {
        console.error('Error scraping institutions:', error.message);
    }
    // De-duplicate
    return institutions.filter((v, i, a) => a.findIndex(t => t.slug === v.slug) === i);
}

/**
 * scrapeCourses(institution, facultyMap)
 * Visits the courses page for an institution and maps courses to faculties.
 */
async function scrapeCourses(institution, facultyMap) {
    console.log(`Deep diving into courses for ${institution.name}...`);
    const facultyGroups = {};

    try {
        const { data } = await axios.get(`${BASE_URL}/classroom/institution-courses/${institution.slug}`);
        const $ = cheerio.load(data);

        $('ul.vert-menu-list li a').each((i, el) => {
            const rawText = $(el).text().trim();
            const href = $(el).attr('href');
            const { name, code } = extractCode(rawText);

            // Extract faculty slug from link: .../university/[faculty-slug]/[course-slug]
            const parts = href.split('/');
            if (parts.length >= 3) {
                const facultySlug = parts[parts.length - 2];
                const typeSlug = parts[parts.length - 3];
                const facultyKey = `${typeSlug}/${facultySlug}`;

                const facultyName = facultyMap[facultyKey] || facultySlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

                if (!facultyGroups[facultyName]) {
                    facultyGroups[facultyName] = {
                        faculty_name: facultyName,
                        courses: []
                    };
                }

                facultyGroups[facultyName].courses.push({
                    course_name: name,
                    course_code: code
                });
            }
        });
    } catch (error) {
        console.error(`Error scraping courses for ${institution.name}:`, error.message);
    }

    return Object.values(facultyGroups);
}

/**
 * Main execution flow
 */
async function main() {
    try {
        const facultyMap = await fetchFacultyMap();
        const institutions = await scrapeInstitutions();

        console.log(`Found ${institutions.length} institutions.`);
        const targetInstitutions = institutions.slice(0, SAMPLE_SIZE);
        console.log(`Scraping a sample of ${targetInstitutions.length} institutions...`);

        const results = [];
        for (const inst of targetInstitutions) {
            const faculties = await scrapeCourses(inst, facultyMap);
            results.push({
                institution: inst.name,
                type: inst.type,
                faculties: faculties
            });

            console.log(`Done with ${inst.name}.`);
            await sleep(DELAY_MS);
        }

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
        console.log(`\nScraping complete! Data saved to ${OUTPUT_FILE}`);
    } catch (error) {
        console.error('Fatal error in main loop:', error.stack);
    }
}

main();
