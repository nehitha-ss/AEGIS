import { spawnSync } from 'node:child_process';
process.env.AEGIS_PUBLIC_BUILD = 'true';
for (const key of ['NEXT_PUBLIC_NORTHSTAR_URL','AEGIS_INTEGRATION_URL']) {
  const url = new URL(process.env[key] || 'http://localhost');
  if (url.protocol !== 'https:' || ['localhost','127.0.0.1'].includes(url.hostname)) throw new Error(`Set ${key} to its actual public HTTPS service origin before building.`);
}
const result = spawnSync(process.execPath, ['node_modules/next/dist/bin/next','build','--webpack'], {stdio:'inherit',env:process.env});
if(result.error)throw result.error;
process.exit(result.status ?? 1);
