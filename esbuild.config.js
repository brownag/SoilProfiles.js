const esbuild = require('esbuild');
const fs = require('fs');

const buildConfigs = [
  {
    format: 'esm',
    minify: false,
    outfile: 'dist/index.esm.js'
  },
  {
    format: 'esm',
    minify: true,
    outfile: 'dist/index.esm.min.js'
  },
  {
    format: 'iife',
    globalName: 'soilprofiles',
    minify: false,
    outfile: 'dist/index.umd.js'
  },
  {
    format: 'iife',
    globalName: 'soilprofiles',
    minify: true,
    outfile: 'dist/index.umd.min.js'
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
