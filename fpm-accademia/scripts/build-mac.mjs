// Crea dist-mac/FPM-Accademia-Mac.zip: server autonomo (PGlite) + app web + avvio con doppio clic.
// Uso: node scripts/build-mac.mjs
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, readdirSync, statSync, writeFileSync, chmodSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist-mac');
const pkg = path.join(out, 'FPM Accademia');
const app = path.join(pkg, 'app');

rmSync(out, { recursive: true, force: true });
mkdirSync(path.join(app, 'server'), { recursive: true });

console.log('1/5 Build dell’app web…');
execFileSync('npm', ['run', 'build', '-w', '@fpm/web'], { cwd: root, stdio: 'inherit' });
cpSync(path.join(root, 'apps/web/dist'), path.join(app, 'web'), { recursive: true });

console.log('2/5 Bundle del server…');
await build({
  entryPoints: [path.join(root, 'apps/server/src/standalone/main.ts')],
  outfile: path.join(app, 'server/fpm-server.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  external: ['@electric-sql/pglite', 'pg-native'],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  legalComments: 'none',
  logLevel: 'warning',
});

// migrate.ts cerca le migrazioni in ../migrations rispetto al file del server.
cpSync(path.join(root, 'apps/server/migrations'), path.join(app, 'migrations'), { recursive: true });

console.log('3/5 Motore database PGlite…');
const pgliteSrc = path.join(root, 'node_modules/@electric-sql/pglite');
const pgliteDst = path.join(app, 'server/node_modules/@electric-sql/pglite');
mkdirSync(path.join(pgliteDst, 'dist'), { recursive: true });
copyFileSync(path.join(pgliteSrc, 'package.json'), path.join(pgliteDst, 'package.json'));
copyFileSync(path.join(pgliteSrc, 'LICENSE'), path.join(pgliteDst, 'LICENSE'));
for (const f of readdirSync(path.join(pgliteSrc, 'dist'))) {
  const src = path.join(pgliteSrc, 'dist', f);
  // Escluse solo le estensioni opzionali di PostgreSQL (.tar.gz) e le source map.
  if (f.endsWith('.tar.gz') || f.endsWith('.map')) continue;
  if (statSync(src).isDirectory()) {
    cpSync(src, path.join(pgliteDst, 'dist', f), { recursive: true, filter: (p) => !p.endsWith('.map') });
  } else {
    copyFileSync(src, path.join(pgliteDst, 'dist', f));
  }
}

console.log('4/5 Avvio e istruzioni…');
const cmd = path.join(pkg, 'Avvia FPM Accademia.command');
copyFileSync(path.join(root, 'packaging/mac/Avvia FPM Accademia.command'), cmd);
chmodSync(cmd, 0o755);
copyFileSync(path.join(root, 'packaging/mac/LEGGIMI.txt'), path.join(pkg, 'LEGGIMI.txt'));
writeFileSync(path.join(app, 'VERSION'), `0.3.0 ${new Date().toISOString()}\n`);

console.log('5/5 Zip…');
execFileSync('zip', ['-qr', '-X', 'FPM-Accademia-Mac.zip', 'FPM Accademia'], { cwd: out });
console.log(`Fatto: ${path.join(out, 'FPM-Accademia-Mac.zip')}`);
