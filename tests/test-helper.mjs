import fs from 'node:fs';

export async function getChromium() {
  try {
    const pw = await import('playwright');
    return pw.chromium;
  } catch (err) {
    const globalPath = 'file:///C:/Users/PCM/AppData/Roaming/npm/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright/index.mjs';
    try {
      const pw = await import(globalPath);
      return pw.chromium;
    } catch {
      throw new Error('Playwright is not installed. Run `pnpm add -D playwright`.');
    }
  }
}

export function getChromeExecutablePath() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const defaultWinPath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (process.platform === 'win32' && fs.existsSync(defaultWinPath)) {
    return defaultWinPath;
  }
  return undefined;
}

export const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5173';
