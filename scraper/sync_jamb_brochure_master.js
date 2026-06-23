const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://myschool.ng';
const DELAY_MS = 250;
const MASTER_FILE = path.join(__dirname, '../akademi-backend/prisma/data/nigerian_tertiary_master.json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalize(value) {
  return (value || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(formerly|former|affl|affiliated|affliated|campus|main campus|open|degree awarding|deg)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|of|and|for|in|at|a|to)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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

  return { name: text.trim(), code: 'N/A' };
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  const institutionArg = process.argv.find((arg) => arg.startsWith('--institution='));

  return {
    apply: args.has('--apply'),
    deep: args.has('--deep'),
    institutionFilter: institutionArg ? institutionArg.replace('--institution=', '').trim().toLowerCase() : null,
  };
}

async function fetchFacultyMap() {
  const facultyMap = {};
  const { data } = await axios.get(`${BASE_URL}/classroom/jamb-brochure`);
  const $ = cheerio.load(data);

  $('a[href*="/classroom/jamb-brochure/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const name = $(el).text().trim();
    const parts = href.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const slug = parts[parts.length - 1];
      const type = parts[parts.length - 2];
      facultyMap[`${type}/${slug}`] = name;
    }
  });

  return facultyMap;
}

async function scrapeInstitutions() {
  const { data } = await axios.get(`${BASE_URL}/institutions`);
  const $ = cheerio.load(data);
  const institutions = [];
  const categories = ['University', 'Polytechnic', 'College of Education'];

  categories.forEach((cat) => {
    const header = $(`h3:contains("${cat}"), h5:contains("${cat}"), b:contains("${cat}")`).filter(
      (_, el) => $(el).text().trim() === cat,
    );
    let container = header.next('ul');
    if (container.length === 0) {
      container = header.parent().find('ul');
    }

    container.find('li a, a').each((_, el) => {
      const name = $(el).text().trim();
      const href = $(el).attr('href') || '';
      if (!href.includes('/institutions/')) return;
      const slug = href.split('/').pop();
      if (slug && slug !== 'institutions' && name) {
        institutions.push({ name, type: cat, slug });
      }
    });
  });

  if (institutions.length === 0) {
    $('a[href*="/institutions/"]').each((_, el) => {
      const name = $(el).text().trim();
      const href = $(el).attr('href') || '';
      const slug = href.split('/').pop();
      if (slug && slug !== 'institutions' && name) {
        institutions.push({ name, type: 'Institution', slug });
      }
    });
  }

  return institutions.filter((item, index, list) => list.findIndex((candidate) => candidate.slug === item.slug) === index);
}

async function scrapeCourses(institution, facultyMap) {
  const facultyGroups = {};

  try {
    const { data } = await axios.get(`${BASE_URL}/classroom/institution-courses/${institution.slug}`);
    const $ = cheerio.load(data);

    $('ul.vert-menu-list li a').each((_, el) => {
      const rawText = $(el).text().trim();
      const href = $(el).attr('href') || '';
      const { name, code } = extractCode(rawText);
      const parts = href.split('/').filter(Boolean);

      if (parts.length < 3 || !name) return;

      const facultySlug = parts[parts.length - 2];
      const typeSlug = parts[parts.length - 3];
      const facultyKey = `${typeSlug}/${facultySlug}`;
      const facultyName =
        facultyMap[facultyKey] ||
        facultySlug.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

      if (!facultyGroups[facultyName]) {
        facultyGroups[facultyName] = { faculty_name: facultyName, courses: [] };
      }

      facultyGroups[facultyName].courses.push({
        course_name: name,
        course_code: code,
      });
    });
  } catch (error) {
    return [];
  }

  return Object.values(facultyGroups);
}

function buildMasterIndex(master) {
  return new Map(master.map((institution, index) => [normalize(institution.institution), { institution, index }]));
}

function mergeInstitution(existingInstitution, scrapedInstitution) {
  let addedFaculties = 0;
  let addedCourses = 0;
  const facultyIndex = new Map(
    existingInstitution.faculties.map((faculty) => [normalize(faculty.faculty_name), faculty]),
  );

  for (const scrapedFaculty of scrapedInstitution.faculties) {
    const facultyKey = normalize(scrapedFaculty.faculty_name);
    const existingFaculty = facultyIndex.get(facultyKey);

    if (!existingFaculty) {
      existingInstitution.faculties.push(scrapedFaculty);
      facultyIndex.set(facultyKey, scrapedFaculty);
      addedFaculties += 1;
      addedCourses += scrapedFaculty.courses.length;
      continue;
    }

    const courseIndex = new Set(existingFaculty.courses.map((course) => normalize(course.course_name)));
    for (const scrapedCourse of scrapedFaculty.courses) {
      const courseKey = normalize(scrapedCourse.course_name);
      if (courseIndex.has(courseKey)) continue;
      existingFaculty.courses.push(scrapedCourse);
      courseIndex.add(courseKey);
      addedCourses += 1;
    }
  }

  existingInstitution.faculties.sort((left, right) => left.faculty_name.localeCompare(right.faculty_name));
  for (const faculty of existingInstitution.faculties) {
    faculty.courses.sort((left, right) => left.course_name.localeCompare(right.course_name));
  }

  return { addedFaculties, addedCourses };
}

async function main() {
  const options = parseArgs();
  const master = JSON.parse(fs.readFileSync(MASTER_FILE, 'utf8'));
  const masterIndex = buildMasterIndex(master);
  const facultyMap = options.deep ? await fetchFacultyMap() : null;
  const scrapedInstitutions = await scrapeInstitutions();
  const filteredInstitutions = options.institutionFilter
    ? scrapedInstitutions.filter((institution) => institution.name.toLowerCase().includes(options.institutionFilter))
    : scrapedInstitutions;

  const report = {
    generatedAt: new Date().toISOString(),
    source: `${BASE_URL}/classroom/jamb-brochure`,
    institutionsChecked: filteredInstitutions.length,
    masterInstitutions: master.length,
    missingInstitutions: [],
    mergedInstitutions: [],
    summary: {
      missingInstitutionCount: 0,
      mergedInstitutionCount: 0,
      addedFacultyCount: 0,
      addedCourseCount: 0,
    },
  };

  for (const institution of filteredInstitutions) {
    const key = normalize(institution.name);
    const existing = masterIndex.get(key);

    if (!existing) {
      if (!options.deep) {
        report.missingInstitutions.push({ name: institution.name, slug: institution.slug, type: institution.type });
        continue;
      }

      const faculties = await scrapeCourses(institution, facultyMap);
      master.push({
        institution: institution.name,
        type: institution.type,
        faculties,
      });
      masterIndex.set(key, { institution: master[master.length - 1], index: master.length - 1 });
      report.missingInstitutions.push({
        name: institution.name,
        slug: institution.slug,
        type: institution.type,
        facultiesAdded: faculties.length,
        departmentsAdded: faculties.reduce((count, faculty) => count + faculty.courses.length, 0),
      });
      await sleep(DELAY_MS);
      continue;
    }

    if (!options.deep) {
      continue;
    }

    const faculties = await scrapeCourses(institution, facultyMap);
    const mergeResult = mergeInstitution(existing.institution, {
      institution: institution.name,
      type: institution.type,
      faculties,
    });

    if (mergeResult.addedFaculties > 0 || mergeResult.addedCourses > 0) {
      report.mergedInstitutions.push({
        name: institution.name,
        slug: institution.slug,
        addedFaculties: mergeResult.addedFaculties,
        addedDepartments: mergeResult.addedCourses,
      });
    }

    await sleep(DELAY_MS);
  }

  report.summary.missingInstitutionCount = report.missingInstitutions.length;
  report.summary.mergedInstitutionCount = report.mergedInstitutions.length;
  report.summary.addedFacultyCount =
    report.missingInstitutions.reduce((count, item) => count + (item.facultiesAdded || 0), 0) +
    report.mergedInstitutions.reduce((count, item) => count + item.addedFaculties, 0);
  report.summary.addedCourseCount =
    report.missingInstitutions.reduce((count, item) => count + (item.departmentsAdded || 0), 0) +
    report.mergedInstitutions.reduce((count, item) => count + item.addedDepartments, 0);

  master.sort((left, right) => left.institution.localeCompare(right.institution));

  if (options.apply && (report.summary.missingInstitutionCount > 0 || report.summary.addedFacultyCount > 0 || report.summary.addedCourseCount > 0)) {
    fs.writeFileSync(MASTER_FILE, JSON.stringify(master, null, 2));
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error('Failed to sync JAMB brochure master data:', error);
  process.exit(1);
});
