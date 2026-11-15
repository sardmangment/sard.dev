import fs from 'fs';
import path from 'path';

const assets = [
  {
    name: 'sard_official_logo',
    category: 'brand',
    sourceUrl: 'https://qnrybiutkrqxvvkdduyi.supabase.co/storage/v1/object/public/media/logos/1766837110566-6n71ur.png',
    destFilename: 'sard-logo-official.png'
  },
  {
    name: 'Eden',
    category: 'partner',
    sourceUrl: 'https://qnrybiutkrqxvvkdduyi.supabase.co/storage/v1/object/public/media/partnerships/1791568039421-e3yq8.png',
    destFilename: 'eden.png'
  },
  {
    name: 'Orbit',
    category: 'partner',
    sourceUrl: 'https://qnrybiutkrqxvvkdduyi.supabase.co/storage/v1/object/public/media/partnerships/1791568067890-alupe.png',
    destFilename: 'orbit.png'
  },
  {
    name: 'Airque',
    category: 'partner',
    sourceUrl: 'https://qnrybiutkrqxvvkdduyi.supabase.co/storage/v1/object/public/media/partnerships/1791568114209-htf48a.png',
    destFilename: 'airque.png'
  },
  {
    name: 'Alsafy',
    category: 'partner',
    sourceUrl: 'https://qnrybiutkrqxvvkdduyi.supabase.co/storage/v1/object/public/media/partnerships/1791568142042-y7je18.png',
    destFilename: 'alsafy.png'
  },
  {
    name: 'Ouruba',
    category: 'partner',
    sourceUrl: 'https://qnrybiutkrqxvvkdduyi.supabase.co/storage/v1/object/public/media/partnerships/1791568174474-xixfd.png',
    destFilename: 'ouruba.png'
  },
  {
    name: 'Mass',
    category: 'partner',
    sourceUrl: 'https://qnrybiutkrqxvvkdduyi.supabase.co/storage/v1/object/public/media/partnerships/1791568216959-w9z41s.png',
    destFilename: 'mass.png'
  },
  {
    name: 'B',
    category: 'partner',
    sourceUrl: 'https://qnrybiutkrqxvvkdduyi.supabase.co/storage/v1/object/public/media/partnerships/1791568237268-dtjf4.png',
    destFilename: 'b.png'
  },
  {
    name: 'Albadr Group',
    category: 'partner',
    sourceUrl: 'https://qnrybiutkrqxvvkdduyi.supabase.co/storage/v1/object/public/media/partnerships/1791281518316-0edgts.png',
    destFilename: 'albadr-group.png'
  },
  {
    name: 'Artal',
    category: 'partner',
    sourceUrl: 'https://qnrybiutkrqxvvkdduyi.supabase.co/storage/v1/object/public/media/partnerships/1791567904863-us74s.png',
    destFilename: 'artal.png'
  },
  {
    name: 'Mardev',
    category: 'partner',
    sourceUrl: 'https://qnrybiutkrqxvvkdduyi.supabase.co/storage/v1/object/public/media/partnerships/1791567939946-lxd5jk.png',
    destFilename: 'mardev.png'
  },
  {
    name: 'Areva',
    category: 'partner',
    sourceUrl: 'https://qnrybiutkrqxvvkdduyi.supabase.co/storage/v1/object/public/media/partnerships/1791567983529-2p4zgd.png',
    destFilename: 'areva.png'
  },
  {
    name: 'Mabany Edris',
    category: 'partner',
    sourceUrl: 'https://qnrybiutkrqxvvkdduyi.supabase.co/storage/v1/object/public/media/partnerships/1791568011595-wexnq.png',
    destFilename: 'mabany-edris.png'
  }
];

const targetDir = 'C:\\Users\\PCM\\Projects\\Portfolio\\sard.dev\\public\\assets\\backup';

async function backupAssets() {
  console.log(`=== BACKING UP 13 LEGACY STORAGE ASSETS ===`);
  console.log(`Destination: ${targetDir}\n`);

  fs.mkdirSync(path.join(targetDir, 'brand'), { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'partners'), { recursive: true });

  const report = [];

  for (const item of assets) {
    const subDir = item.category === 'brand' ? 'brand' : 'partners';
    const filePath = path.join(targetDir, subDir, item.destFilename);

    try {
      const res = await fetch(item.sourceUrl);
      const status = res.status;
      const contentType = res.headers.get('content-type');

      if (!res.ok) {
        report.push({
          name: item.name,
          status: `Failed HTTP ${status}`,
          sourceUrl: item.sourceUrl,
          saved: false
        });
        continue;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(filePath, buffer);

      const stats = fs.statSync(filePath);

      report.push({
        name: item.name,
        category: item.category,
        httpStatus: status,
        contentType,
        bytes: stats.size,
        savedTo: filePath,
        sourceUrl: item.sourceUrl,
        valid: stats.size > 0
      });
      console.log(`✅ [${status}] ${item.name} (${stats.size} bytes) -> ${item.destFilename}`);
    } catch (err) {
      report.push({
        name: item.name,
        status: `Error: ${err.message}`,
        sourceUrl: item.sourceUrl,
        saved: false
      });
      console.error(`❌ ${item.name}: ${err.message}`);
    }
  }

  console.log('\n=== BACKUP SUMMARY ===');
  console.log(`Total Assets Checked: ${assets.length}`);
  console.log(`Successfully Backed Up: ${report.filter(r => r.valid).length}`);

  fs.writeFileSync(
    'C:\\Users\\PCM\\Projects\\Portfolio\\docs\\SARD_UNIFIED_ASSET_BACKUP_MANIFEST.json',
    JSON.stringify(report, null, 2)
  );
}

backupAssets();
