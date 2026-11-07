// One-off installer: fetches @ikas registry items and writes their files to src/.
// (shadcn CLI fails on this Windows machine; see project memory.)
// Installs @ikas registryDependencies recursively and never overwrites a file
// that already exists, so local edits survive re-runs.
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const NAMES = process.argv.slice(2);
const REGISTRY = 'https://builders.ikas.com/r';
const visited = new Set();

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function resolveTarget(file, itemName) {
  if (file.target) {
    return file.target
      .replace(/^@components\//, 'src/components/')
      .replace(/^@lib\//, 'src/lib/')
      .replace(/^@hooks\//, 'src/hooks/')
      .replace(/^@\/components\//, 'src/components/')
      .replace(/^@\/lib\//, 'src/lib/')
      .replace(/^@\/hooks\//, 'src/hooks/');
  }
  const base = file.path.split('/').pop();
  if (file.type === 'registry:ui') return join('src/components/ui', base);
  if (file.type === 'registry:component') return join('src/components/ikas', base);
  if (file.type === 'registry:lib') return join('src/lib', base);
  if (file.type === 'registry:hook') return join('src/hooks', base);
  throw new Error(`No target for ${itemName}: ${file.path}`);
}

async function install(name) {
  if (visited.has(name)) return;
  visited.add(name);

  const res = await fetch(`${REGISTRY}/${name}.json`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const item = await res.json();

  for (const dep of item.registryDependencies ?? []) {
    if (dep.startsWith('@ikas/')) await install(dep.replace(/^@ikas\//, ''));
  }

  for (const file of item.files ?? []) {
    const target = resolveTarget(file, name);
    if (await exists(target)) {
      console.log(`kept  ${target}`);
      continue;
    }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, 'utf8');
    console.log(`wrote ${target}`);
  }
  console.log(`installed @ikas/${name}`);
}

for (const name of NAMES) {
  await install(name);
}
