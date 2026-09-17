const esbuild = require('esbuild');
const fs = require('fs');

const buildConfigs = [
  {
    entryPoints: ['src/index.ts'],
    format: 'esm',
    minify: false,
    outfile: 'dist/index.esm.js'
  },
  {
    entryPoints: ['src/index.ts'],
    format: 'esm',
    minify: true,
    outfile: 'dist/index.esm.min.js'
  },
  {
    entryPoints: ['src/index.ts'],
    format: 'iife',
    globalName: 'soilprofiles',
    minify: false,
    outfile: 'dist/index.umd.js'
  },
  {
    entryPoints: ['src/index.ts'],
    format: 'iife',
    globalName: 'soilprofiles',
    minify: true,
    outfile: 'dist/index.umd.min.js'
  },
  {
    entryPoints: ['src/core.ts'],
    format: 'esm',
    minify: false,
    outfile: 'dist/core.esm.js'
  },
  {
    entryPoints: ['src/static.ts'],
    format: 'esm',
    minify: false,
    outfile: 'dist/static.esm.js'
  },
  {
    entryPoints: ['src/interactive.ts'],
    format: 'esm',
    minify: false,
    outfile: 'dist/interactive.esm.js'
  },
  {
    entryPoints: ['src/parsers/osd.ts'],
    format: 'esm',
    minify: false,
    outfile: 'dist/parsers/osd.esm.js'
  },
  {
    entryPoints: ['src/parsers/simple.ts'],
    format: 'esm',
    minify: false,
    outfile: 'dist/parsers/simple.esm.js'
  },
  {
    entryPoints: ['src/parsers/delimited.ts'],
    format: 'esm',
    minify: false,
    outfile: 'dist/parsers/delimited.esm.js'
  }
];

const commonOptions = {
  entryPoints: ['src/index.ts'],
  sourcemap: true,
  target: 'ES2020',
  platform: 'browser',
  bundle: true,
  external: ['three']
};

(async () => {
  try {
    for (const config of buildConfigs) {
      await esbuild.build({
        ...commonOptions,
        ...config
      });

      // For IIFE/UMD output, add window global assignment before source map comment
      if (config.format === 'iife') {
        let content = fs.readFileSync(config.outfile, 'utf8');
        // Insert window assignment before the sourceMappingURL comment
        content = content.replace(
          /(\n\/\/# sourceMappingURL=)/,
          '\nif (typeof window !== "undefined") window.soilprofiles = soilprofiles;$1'
        );
        fs.writeFileSync(config.outfile, content);
      }

      const size = fs.statSync(config.outfile).size;
      console.log(`✓ ${config.outfile} (${(size / 1024).toFixed(1)} KB)`);
    }
    console.log('\nAll builds complete.');
  } catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
  }
})();
