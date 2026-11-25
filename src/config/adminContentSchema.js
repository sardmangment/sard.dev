// DEV-194: editable site content managed from /admin.
// Shared by the admin API (validation, api/admin/content.js) and the admin UI (forms).
// Field types: text, textarea, url (http/https), image (site path or http/https URL), date, enum, bool.

export const CONTENT_TYPES = {
  projects: {
    table: 'projects',
    titleFields: ['title_ar', 'title_en'],
    imageField: 'image_url',
    uploadFolder: 'projects',
    fields: [
      { name: 'title_ar', type: 'text', required: true, max: 150, dir: 'rtl' },
      { name: 'title_en', type: 'text', required: true, max: 150, dir: 'ltr' },
      { name: 'description_ar', type: 'textarea', max: 3000, dir: 'rtl' },
      { name: 'description_en', type: 'textarea', max: 3000, dir: 'ltr' },
      { name: 'status', type: 'enum', options: ['in_development', 'launched'], required: true, default: 'in_development' },
      { name: 'project_date', type: 'date' },
      { name: 'image_url', type: 'image', max: 500 },
      { name: 'project_link', type: 'url', max: 500 },
      { name: 'is_published', type: 'bool', default: true },
    ],
  },
  openings: {
    table: 'job_openings',
    titleFields: ['title_ar', 'title_en'],
    fields: [
      { name: 'kind', type: 'enum', options: ['job', 'training'], required: true, default: 'job' },
      { name: 'title_ar', type: 'text', required: true, max: 150, dir: 'rtl' },
      { name: 'title_en', type: 'text', required: true, max: 150, dir: 'ltr' },
      { name: 'description_ar', type: 'textarea', max: 4000, dir: 'rtl' },
      { name: 'description_en', type: 'textarea', max: 4000, dir: 'ltr' },
      { name: 'location_ar', type: 'text', max: 120, dir: 'rtl' },
      { name: 'location_en', type: 'text', max: 120, dir: 'ltr' },
      { name: 'work_mode', type: 'enum', options: ['onsite', 'remote', 'hybrid'] },
      { name: 'closes_at', type: 'date' },
      { name: 'apply_url', type: 'url', max: 500 },
      { name: 'is_published', type: 'bool', default: false },
    ],
  },
  collaborations: {
    table: 'collaborations',
    titleFields: ['name_ar', 'name_en'],
    imageField: 'logo_url',
    uploadFolder: 'collaborations',
    fields: [
      { name: 'name_ar', type: 'text', required: true, max: 150, dir: 'rtl' },
      { name: 'name_en', type: 'text', required: true, max: 150, dir: 'ltr' },
      { name: 'kind', type: 'enum', options: ['academic', 'business', 'training', 'other'], required: true, default: 'business' },
      { name: 'description_ar', type: 'textarea', max: 2000, dir: 'rtl' },
      { name: 'description_en', type: 'textarea', max: 2000, dir: 'ltr' },
      { name: 'started_on', type: 'date' },
      { name: 'logo_url', type: 'image', max: 500 },
      { name: 'website_url', type: 'url', max: 500 },
      { name: 'is_published', type: 'bool', default: false },
    ],
  },
  // DEV-190: the "Our Partners in Success" ribbon on the home page (read through get_published_partners).
  // Only these columns are loaded into the admin: contract fields stay out of the browser.
  // is_active is always set: visibility is controlled by is_published alone.
  partners: {
    table: 'partnerships',
    titleFields: ['partner_name_ar', 'partner_name_en'],
    imageField: 'partner_logo_url',
    uploadFolder: 'partners',
    select: 'id,partner_name_ar,partner_name_en,partner_logo_url,public_summary_ar,public_summary_en,is_published,display_order,created_at',
    alwaysSet: { is_active: true },
    fields: [
      { name: 'partner_name_ar', type: 'text', required: true, max: 150, dir: 'rtl' },
      { name: 'partner_name_en', type: 'text', required: true, max: 150, dir: 'ltr' },
      { name: 'partner_logo_url', type: 'image', max: 500 },
      { name: 'public_summary_ar', type: 'textarea', max: 2000, dir: 'rtl' },
      { name: 'public_summary_en', type: 'textarea', max: 2000, dir: 'ltr' },
      { name: 'is_published', type: 'bool', default: false },
    ],
  },
  // DEV-199: /team (owners, department heads, staff). Only current members are managed here; alumni and
  // interns rows are left alone (filter). Email, phone, LinkedIn, bio and consent columns are never loaded.
  // New members are active current members; is_published alone decides whether they show on /team.
  team: {
    table: 'team_members',
    titleFields: ['name_ar', 'name_en'],
    subtitleFields: ['role_ar', 'role_en'],
    imageField: 'photo_url',
    uploadFolder: 'team',
    filter: 'member_type=eq.current',
    select: 'id,name_ar,name_en,role_ar,role_en,tier,photo_url,is_published,display_order,created_at',
    insertSet: { is_active: true, member_type: 'current' },
    fields: [
      { name: 'name_ar', type: 'text', required: true, max: 120, dir: 'rtl' },
      { name: 'name_en', type: 'text', required: true, max: 120, dir: 'ltr' },
      { name: 'role_ar', type: 'text', required: true, max: 150, dir: 'rtl' },
      { name: 'role_en', type: 'text', required: true, max: 150, dir: 'ltr' },
      { name: 'tier', type: 'enum', options: ['owner', 'manager', 'staff'], required: true, default: 'staff' },
      { name: 'photo_url', type: 'image', max: 500 },
      { name: 'is_published', type: 'bool', default: false },
    ],
  },
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HTTP_RE = /^https?:\/\/[^\s<>"']+$/i;
const SITE_PATH_RE = /^\/[A-Za-z0-9/_\-.]+$/;

export function emptyRecord(type) {
  const rec = {};
  for (const f of CONTENT_TYPES[type].fields) {
    rec[f.name] = f.default !== undefined ? f.default : (f.type === 'bool' ? false : '');
  }
  return rec;
}

/**
 * Validates and normalises an incoming record.
 * partial=true (PATCH): only the fields present are checked; required fields may be omitted.
 * Returns { data } or { errors: [fieldName, ...] }. Unknown fields are dropped.
 */
export function validateRecord(type, input, { partial = false } = {}) {
  const def = CONTENT_TYPES[type];
  if (!def || !input || typeof input !== 'object') return { errors: ['body'] };
  const data = {};
  const errors = [];

  for (const f of def.fields) {
    const present = Object.prototype.hasOwnProperty.call(input, f.name);
    if (!present) {
      if (!partial && f.required) errors.push(f.name);
      continue;
    }
    let v = input[f.name];

    if (f.type === 'bool') {
      if (typeof v !== 'boolean') errors.push(f.name);
      else data[f.name] = v;
      continue;
    }

    if (v === null || v === undefined) v = '';
    if (typeof v !== 'string') { errors.push(f.name); continue; }
    v = v.trim();

    if (v === '') {
      if (f.required) errors.push(f.name);
      else data[f.name] = null;
      continue;
    }
    if (f.max && v.length > f.max) { errors.push(f.name); continue; }

    let ok = true;
    if (f.type === 'enum') ok = f.options.includes(v);
    else if (f.type === 'date') ok = DATE_RE.test(v) && !Number.isNaN(Date.parse(v));
    else if (f.type === 'url') ok = HTTP_RE.test(v);
    else if (f.type === 'image') ok = HTTP_RE.test(v) || (SITE_PATH_RE.test(v) && !v.includes('..'));
    if (!ok) { errors.push(f.name); continue; }
    data[f.name] = v;
  }

  if (partial && Object.keys(data).length === 0 && errors.length === 0) errors.push('body');
  return errors.length ? { errors } : { data };
}
