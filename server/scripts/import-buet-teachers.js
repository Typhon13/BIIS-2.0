require('dotenv').config();

const cheerio = require('cheerio');
const db = require('../src/config/db');
const passwordUtils = require('../src/utils/password.utils');

const sources = [
  ['CE', 'https://ce.buet.ac.bd/faculty/'],
  ['EEE', 'https://eee.buet.ac.bd/people/faculty'],
  ['CSE', 'https://cse.buet.ac.bd/faculty'],
  ['NAME', 'https://name.buet.ac.bd/active-faculty'],
  ['ME', 'https://me.buet.ac.bd/faculty'],
  ['IPE', 'https://ipe.buet.ac.bd/active-faculty-members'],
  ['URP', 'https://urp.buet.ac.bd/Web/Faculty_Members_Active'],
  ['Arch', 'https://arch.buet.ac.bd/faculty'],
  ['BME', 'https://bme.buet.ac.bd/current-faculty/'],
  ['Ch.E', 'https://chebuet.github.io/people/faculty.html'],
  ['Chem', 'https://chem.buet.ac.bd/faculties/'],
  ['Hum', 'https://hum.buet.ac.bd/faculties.html'],
  ['MME', 'https://mme.buet.ac.bd/people/teaching-staff/'],
  ['Math', 'https://math.buet.ac.bd/Web/Faculty_Members_Active'],
  ['PMRE', 'https://pmre.buet.ac.bd/faculty'],
  ['Phys', 'https://phy.buet.ac.bd/faculties'],
  ['WRE', 'https://wre.buet.ac.bd/faculty.html'],
  ['NCE', 'https://nce.buet.ac.bd/people/faculty/'],
];

const rankPattern = /\b(Professor(?: Emeritus)?|Associate Professor|Assistant Professor|Lecturer|Instructor|Head of the Department|Professor and Head|Professor & Head|Adjunct faculty)\b/i;
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const architectureFaculty = [
  ['Catherine Daisy Gomes', 'Professor'],
  ['Khandaker Shabbir Ahmed', 'Professor'],
  ['Shayer Ghafur', 'Professor'],
  ['Nasreen Hossain', 'Professor'],
  ['Mohammed Zakiul Islam', 'Professor'],
  ['S M Najmul Imam', 'Professor'],
  ['Md Ashikur Rahman Joarder', 'Professor'],
  ['Nayma Khan', 'Professor'],
  ['Apurba K Podder', 'Professor'],
  ['Sheikh Ahsan Ullah Mojumder', 'Associate Professor'],
  ['Fatema Meher Khan', 'Associate Professor'],
  ['Asma Naz', 'Associate Professor'],
  ['Atiqur Rahman', 'Assistant Professor'],
  ['Md Ruhul Amin', 'Assistant Professor'],
  ['Md Tarek Haider', 'Assistant Professor'],
  ['Patrick D’ Rozario', 'Assistant Professor'],
  ['Tasneem Tariq', 'Assistant Professor'],
  ['Nesfun Nahar', 'Assistant Professor'],
  ['Syma Haque Trisha', 'Assistant Professor'],
  ['Md Mizanur Rahman', 'Assistant Professor'],
  ['Mohammad Tahajibul Hossain', 'Assistant Professor'],
  ['Sayed Abu Sufian Kushol', 'Assistant Professor'],
  ['Md Tariquzzaman', 'Assistant Professor'],
  ['Mohaimeen Islam', 'Assistant Professor'],
  ['Maherul Kader Prince', 'Assistant Professor'],
  ['Fatema Tasmia', 'Assistant Professor'],
  ['Simita Roy', 'Assistant Professor'],
  ['Nayna Tabassum', 'Assistant Professor'],
  ['Brishti Majumder', 'Assistant Professor'],
  ['Ahammad-Al-Muhaymin', 'Assistant Professor'],
  ['Alia Shahed', 'Assistant Professor'],
  ['Md Muktadir Rahman', 'Assistant Professor'],
  ['Rafia Rukhsat', 'Assistant Professor'],
  ['Gourab Kundu', 'Assistant Professor'],
  ['Fouzia Masud Mouri', 'Assistant Professor'],
  ['Afeefa Adeeba Rahman', 'Assistant Professor'],
  ['Dipannita Nandi', 'Lecturer'],
  ['Fabiha Tahmina', 'Lecturer'],
  ['Nayem Ahasan Srijon', 'Lecturer'],
  ['Pronoy Chowdhury', 'Lecturer'],
  ['Ridwan Noor', 'Lecturer'],
  ['Md. Sarowar Jahan Apu', 'Lecturer'],
  ['Nawshin Ahmed', 'Lecturer'],
  ['Faizah Rafsan', 'Lecturer'],
].map(([name, designation]) => ({ name, designation, email: null }));

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim();
}

function normalizeName(value) {
  return cleanText(value)
    .replace(/^\s*(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slug(value) {
  return normalizeName(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 58);
}

function isUsefulName(value) {
  const name = normalizeName(value);
  if (name.length < 4 || name.length > 100) return false;
  if (/^(view profile|more info|home|faculty|people|department|contact|login|read more)$/i.test(name)) return false;
  if (/^(image|avatar|logo|blank|unnamed)/i.test(name)) return false;
  return /[a-z]/i.test(name) && !/\.(jpg|jpeg|png|gif|svg)$/i.test(name);
}

function nearestBlock($, element) {
  const block = $(element).closest('article, tr, li, .card, .faculty, .team-member, .member, .person, .profile, .faculty-member, .col-md-4, .col-lg-4, .col-md-6, .col-lg-6');
  return block.length ? block : $(element).parent();
}

function designationFrom(text) {
  const match = cleanText(text).match(rankPattern);
  return match ? match[0].replace(/\s+/g, ' ').trim() : 'Faculty Member';
}

function emailFrom(text) {
  const matches = cleanText(text).match(emailPattern) || [];
  return matches.find((email) => !/head|info|office|contact/i.test(email)) || matches[0] || null;
}

function profileLink(url, href) {
  try {
    const link = new URL(href, url);
    const path = link.pathname.toLowerCase();
    return /faculty|profile|memberdetails|peoples|people\//.test(path) && !/faculty\/?$|faculties\/?$|active-faculty/.test(path);
  } catch {
    return false;
  }
}

function extractFromAnchors($, url) {
  const records = [];
  const seen = new Set();

  $('a[href]').each((_, element) => {
    if (!profileLink(url, $(element).attr('href'))) return;
    const link = new URL($(element).attr('href'), url);
    const pathName = decodeURIComponent(link.pathname.split('/').filter(Boolean).pop() || '')
      .replace(/[-_]+/g, ' ');
    const name = normalizeName($(element).text() || pathName);
    if (!isUsefulName(name) || seen.has(name.toLowerCase())) return;

    const block = nearestBlock($, element);
    const text = cleanText(block.text());
    const email = emailFrom(text);
    const designation = designationFrom(text);
    seen.add(name.toLowerCase());
    records.push({ name, designation, email });
  });

  return records;
}

function extractFromEmails($) {
  const records = [];
  const seen = new Set();

  $('a[href^="mailto:"]').each((_, element) => {
    const email = $(element).attr('href').replace(/^mailto:/i, '').split('?')[0].trim();
    if (!emailPattern.test(email)) return;
    emailPattern.lastIndex = 0;

    const block = nearestBlock($, element);
    const links = block.find('a').toArray().map((link) => normalizeName($(link).text())).filter(isUsefulName);
    const headings = block.find('h2, h3, h4, h5, h6').toArray().map((heading) => normalizeName($(heading).text())).filter(isUsefulName);
    const name = headings[0] || links.find((value) => !value.includes('@'));
    if (!name || seen.has(name.toLowerCase())) return;

    seen.add(name.toLowerCase());
    records.push({ name, designation: designationFrom(cleanText(block.text())), email });
  });

  return records;
}

function extractFromHeadings($) {
  const records = [];
  const seen = new Set();

  $('h2, h3, h4, h5, h6').each((_, element) => {
    const name = normalizeName($(element).text());
    if (!isUsefulName(name) || seen.has(name.toLowerCase())) return;
    const block = $(element).nextUntil('h3, h4, h5, h6').addBack().add($(element).parent());
    const text = cleanText(block.text());
    if (!emailFrom(text) && !rankPattern.test(text)) return;
    seen.add(name.toLowerCase());
    records.push({ name, designation: designationFrom(text), email: emailFrom(text) });
  });

  return records;
}

function extractWre($) {
  const records = [];
  $('tr').each((_, row) => {
    const text = cleanText($(row).text());
    const email = emailFrom(text);
    if (!email) return;
    const rank = designationFrom(text);
    const beforeRank = text.split(rankPattern)[0];
    const name = normalizeName(beforeRank.replace(/^\|+|\s*\|+\s*$/g, ''));
    if (isUsefulName(name)) records.push({ name, designation: rank, email });
  });
  return records;
}

function dedupe(records) {
  const byEmail = new Map();
  const byName = new Map();
  for (const record of records) {
    const key = record.email ? record.email.toLowerCase() : record.name.toLowerCase();
    if (byEmail.has(key) || byName.has(record.name.toLowerCase())) continue;
    if (record.email) byEmail.set(key, record);
    byName.set(record.name.toLowerCase(), record);
  }
  return [...byName.values()];
}

async function fetchSource([deptShortName, url]) {
  const response = await fetch(url, { headers: { 'User-Agent': 'BIIS BUET faculty importer' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const html = await response.text();
  const $ = cheerio.load(html);
  $('script, style, noscript, nav, footer').remove();
  const records = deptShortName === 'Arch'
    ? architectureFaculty
    : deptShortName === 'WRE'
    ? extractWre($)
    : dedupe([...extractFromAnchors($, url), ...extractFromHeadings($), ...extractFromEmails($)]);
  return { deptShortName, url, records };
}

async function findDepartment(client, shortName) {
  const result = await client.query(
    `SELECT dept_id, dept_name, dept_short_name
       FROM departments
      WHERE REPLACE(LOWER(dept_short_name), '.', '') = REPLACE(LOWER($1), '.', '')`,
    [shortName],
  );
  return result.rows[0];
}

function fallbackEmail(deptShortName, name) {
  return `${slug(name)}@${deptShortName.toLowerCase().replace(/[^a-z0-9]/g, '')}.buet.ac.bd`;
}

async function importTeachers({ dryRun = false } = {}) {
  const password = process.env.BUET_TEACHER_IMPORT_PASSWORD;
  if (!dryRun && (!password || password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password))) {
    throw new Error('BUET_TEACHER_IMPORT_PASSWORD must be at least 8 characters and include uppercase, lowercase, and a number');
  }

  const results = await Promise.all(sources.map(async (source) => {
    try {
      return await fetchSource(source);
    } catch (error) {
      return { deptShortName: source[0], url: source[1], records: [], error: error.message };
    }
  }));

  for (const result of results) {
    console.log(`${result.deptShortName}: ${result.records.length} records${result.error ? ` (${result.error})` : ''}`);
  }
  if (dryRun) return results;

  const passwordHash = await passwordUtils.hashPassword(password);
  const client = await db.pool.connect();
  let imported = 0;
  let skipped = 0;

  try {
    await client.query('BEGIN');
    const teacherRole = await client.query("SELECT role_id FROM roles WHERE role_name = 'TEACHER'");
    if (!teacherRole.rows[0]) throw new Error('TEACHER role is missing');

    for (const result of results) {
      const department = await findDepartment(client, result.deptShortName);
      if (!department) {
        console.warn(`${result.deptShortName}: department not found; skipped`);
        skipped += result.records.length;
        continue;
      }

      for (const record of result.records) {
        const email = record.email ? record.email.toLowerCase() : null;
        const username = `teacher.${result.deptShortName.toLowerCase().replace(/[^a-z0-9]/g, '')}.${slug(record.name)}`.slice(0, 80);
        if (!email) {
          console.warn(`${result.deptShortName}: ${record.name} has no public email; imported without a login account`);
          skipped += 1;
          continue;
        }
        const existing = await client.query(
          `SELECT u.user_id, r.role_name
             FROM users u
             JOIN roles r ON r.role_id = u.role_id
            WHERE LOWER(u.email) = LOWER($1) OR LOWER(u.username) = LOWER($2)
            LIMIT 1
            FOR UPDATE`,
          [email, username],
        );

        if (existing.rows[0] && existing.rows[0].role_name !== 'TEACHER') {
          skipped += 1;
          continue;
        }

        let userId;
        if (existing.rows[0]) {
          userId = existing.rows[0].user_id;
          await client.query(
            `UPDATE users
                SET email = $1, role_id = $2, account_status = 'ACTIVE'
              WHERE user_id = $3`,
            [email, teacherRole.rows[0].role_id, userId],
          );
        } else {
          const user = await client.query(
            `INSERT INTO users (username, email, password_hash, role_id, account_status)
             VALUES ($1, $2, $3, $4, 'ACTIVE')
             RETURNING user_id`,
            [username, email, passwordHash, teacherRole.rows[0].role_id],
          );
          userId = user.rows[0].user_id;
        }

        await client.query(
          `INSERT INTO teachers (user_id, name, designation, dept_id, phone)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id) DO UPDATE
             SET name = EXCLUDED.name,
                 designation = EXCLUDED.designation,
                 dept_id = EXCLUDED.dept_id,
                 phone = EXCLUDED.phone`,
          [userId, record.name, record.designation, department.dept_id, record.phone || null],
        );
        imported += 1;
      }
    }

    await client.query('COMMIT');
    console.log(`Imported or updated ${imported} teachers; skipped ${skipped}.`);
    return { imported, skipped, results };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  importTeachers({ dryRun: process.argv.includes('--dry-run') })
    .catch((error) => {
      console.error(`BUET teacher import failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(() => db.pool.end());
}

module.exports = { sources, importTeachers, fetchSource };
