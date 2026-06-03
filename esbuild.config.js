const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const isWatch = process.argv.includes('--watch');

const commonOptions = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  external: ['electron', 'pg', 'bcrypt', 'pg-native'],
};

const mainConfig = {
  ...commonOptions,
  entryPoints: ['src/main/index.ts'],
  outfile: 'dist/main/index.js',
};

const preloadConfig = {
  ...commonOptions,
  entryPoints: ['src/main/preload.ts'],
  outfile: 'dist/main/preload.js',
};

const rendererConfig = {
  ...commonOptions,
  entryPoints: ['src/renderer/index.ts'],
  outfile: 'dist/renderer/index.js',
  platform: 'browser',
  target: 'chrome120',
  external: [],
};

const migrationsRunnerConfig = {
  ...commonOptions,
  entryPoints: ['src/main/run-migrations.ts'],
  outfile: 'dist/main/run-migrations.js',
};

const seedUsersConfig = {
  ...commonOptions,
  entryPoints: ['src/main/seed-users.ts'],
  outfile: 'dist/main/seed-users.js',
};

const testFiles = fs.readdirSync('tests').filter(f => f.endsWith('.test.ts'));
const testConfigs = testFiles.map(f => ({
  ...commonOptions,
  entryPoints: [`tests/${f}`],
  outfile: `dist/tests/${f.replace('.ts', '.js')}`,
}));

function copyHtml() {
  const srcDir = 'src/renderer';
  const dstDir = 'dist/renderer';
  fs.mkdirSync(dstDir, { recursive: true });
  fs.readdirSync(srcDir).forEach(f => {
    if (f.endsWith('.html')) fs.copyFileSync(path.join(srcDir, f), path.join(dstDir, f));
  });
}

function copySql() {
  const srcDir = 'src/main/migrations';
  const dstDir = 'dist/main/migrations';
  fs.mkdirSync(dstDir, { recursive: true });
  fs.readdirSync(srcDir).forEach(f => {
    if (f.endsWith('.sql')) {
      fs.copyFileSync(path.join(srcDir, f), path.join(dstDir, f));
    }
  });
}

async function build() {
  fs.mkdirSync('dist/tests', { recursive: true });
  const contexts = await Promise.all([
    esbuild.context(mainConfig),
    esbuild.context(preloadConfig),
    esbuild.context(rendererConfig),
    esbuild.context(migrationsRunnerConfig),
    esbuild.context(seedUsersConfig),
    ...testConfigs.map(cfg => esbuild.context(cfg)),
  ]);

  for (const ctx of contexts) {
    await ctx.rebuild();
  }

  copyHtml();
  copySql();

  if (isWatch) {
    console.log('[esbuild] Watching for changes...');
    for (const ctx of contexts) {
      await ctx.watch();
    }
    // Watch HTML and SQL manually
    fs.watch('src/renderer/index.html', () => { copyHtml(); console.log('[esbuild] Copied index.html'); });
    fs.watch('src/main/migrations', () => { copySql(); console.log('[esbuild] Copied SQL migrations'); });
  } else {
    for (const ctx of contexts) {
      await ctx.dispose();
    }
    console.log('[esbuild] Build complete.');
  }
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
