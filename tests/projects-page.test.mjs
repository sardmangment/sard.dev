import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('Projects Page structural and non-blocking state verification', () => {
  const pagePath = resolve('src/pages/ProjectsPage.tsx');
  const code = readFileSync(pagePath, 'utf-8');

  // STEP 1: Verifying elimination of blocking loading screen
  assert.ok(
    !code.includes('if (loading) {') && (code.includes('<Navbar logoUrl={settings?.logo_url}') || code.includes('<SiteNavbar')),
    'Blocking full-page loading screen must be eliminated; Navbar and shell stay persistently mounted.'
  );

  // STEP 2: Verifying decoupled state for projects vs footer
  const hasIndependentProjects = code.includes('projectsLoading') && code.includes('projectsError');
  const hasIndependentFooter = code.includes('footerLoading') && code.includes('setFooterLoading');
  assert.ok(
    hasIndependentProjects && hasIndependentFooter,
    'Projects and Footer must have fully decoupled state management.'
  );

  // STEP 3: Verifying Skeleton integration for projects
  assert.ok(
    code.includes('<Skeleton className="aspect-video w-full"') && code.includes('projectsLoading ? ('),
    '6-card Skeleton grid rendered during projects loading without CLS.'
  );

  // STEP 4: Verifying error handling and retry mechanism
  assert.ok(
    code.includes('projectsError ?') && code.includes('onClick={fetchProjects}'),
    'Error state must include localized message and retry button.'
  );

  // STEP 5: Verifying real footer data passing
  assert.ok(
    code.includes('links={footerLinks}') && code.includes('contactInfo={contactInfo || undefined}') && !code.includes('links={[]}'),
    'Footer must receive actual footerLinks and contactInfo (links={[]} completely removed).'
  );
});
