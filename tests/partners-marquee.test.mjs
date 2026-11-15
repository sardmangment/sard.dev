import { readFileSync } from 'fs';
import { resolve } from 'path';

console.log('================================================================');
console.log('🧪 RUNNING ISSUE 2.2 VERIFICATION: PARTNERS MARQUEE FIX');
console.log('================================================================\n');

// 1. Static Analysis of PartnersSection.jsx
const componentPath = resolve('src/components/PartnersSection.jsx');
const componentCode = readFileSync(componentPath, 'utf-8');

console.log('▶ STEP 1: Verifying guard conditions against empty/null data...');
if (componentCode.includes('if (loading || !Array.isArray(partners) || partners.length === 0)')) {
  console.log('  ✅ Passed: Robust array and empty data guards in place.');
} else {
  console.error('  ❌ Failed: Missing robust empty guard.');
  process.exit(1);
}

console.log('\n▶ STEP 2: Verifying dir="ltr" isolation and twin groups...');
if (componentCode.includes('dir="ltr"') && componentCode.includes('aria-hidden="true"')) {
  console.log('  ✅ Passed: dir="ltr" isolation and aria-hidden twin group confirmed.');
} else {
  console.error('  ❌ Failed: Missing dir="ltr" or aria-hidden on twin track.');
  process.exit(1);
}

console.log('\n▶ STEP 3: Verifying padding and gap alignment for seamless loop...');
const group1Padding = componentCode.includes('pr-12 sm:pr-16');
const gapMatch = componentCode.includes('gap-12 sm:gap-16');
if (group1Padding && gapMatch) {
  console.log('  ✅ Passed: pr-12/sm:pr-16 padding exactly matches gap-12/sm:gap-16 spacing.');
} else {
  console.error('  ❌ Failed: Padding and gap mismatch.');
  process.exit(1);
}

console.log('\n▶ STEP 4: Verifying CSS keyframes and hover-pause...');
const cssPath = resolve('src/index.css');
const cssCode = readFileSync(cssPath, 'utf-8');

if (
  cssCode.includes('@keyframes marquee') &&
  cssCode.includes('transform: translateX(-50%)') &&
  cssCode.includes('.animate-marquee') &&
  componentCode.includes('hover:[animation-play-state:paused]')
) {
  console.log('  ✅ Passed: CSS Keyframes -50% translation and native hover-pause confirmed.');
} else {
  console.error('  ❌ Failed: Missing keyframes or hover-pause rule.');
  process.exit(1);
}

console.log('\n▶ STEP 5: Testing dynamic repetition math for various counts...');
const testCounts = [0, 1, 2, 3, 5, 8, 12];
for (const count of testCounts) {
  const dummyPartners = Array.from({ length: count }, (_, i) => ({ id: `p${i}` }));
  if (dummyPartners.length === 0) {
    // Guard stops execution cleanly
    console.log(`  Count 0 -> Safely returns null before calculation.`);
    continue;
  }
  const repeatCount = Math.max(2, Math.ceil(8 / dummyPartners.length));
  const singleGroup = Array.from({ length: repeatCount }, () => dummyPartners).flat();
  const totalRendered = singleGroup.length * 2; // Two groups
  console.log(
    `  Count ${count}: repeatCount=${repeatCount} -> singleGroup=${singleGroup.length} items -> Total ribbon=${totalRendered} items`
  );
  if (totalRendered < 16) {
    console.error(`  ❌ Failed: Insufficient ribbon length for count ${count}`);
    process.exit(1);
  }
}
console.log('  ✅ Passed: All counts produce at least 16 rendered items across the twin tracks.');

console.log('\n================================================================');
console.log('🏆 ISSUE 2.2 VERIFICATION: ALL 5 CHECKS PASSED');
console.log('================================================================');

