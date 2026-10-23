// Launches the Playwright MCP server for Claude Code (see .mcp.json).
// Cloud sessions ship Chromium at /opt/pw-browsers; locally Playwright uses its own browser.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const cloudChromium = '/opt/pw-browsers/chromium';
const args = ['-y', '@playwright/mcp@latest', '--browser', 'chromium', '--device', 'Pixel 7'];
if (existsSync(cloudChromium)) args.push('--headless', '--executable-path', cloudChromium);

const child = spawn('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' });
child.on('exit', (code) => process.exit(code ?? 1));
