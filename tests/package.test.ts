import { existsSync, readFileSync } from 'fs';
import path from 'path';
import {
    renderInteractive3D,
    DelimitedParser,
    OSDParser,
    SimpleParser,
    parseDelimitedHorizons,
    parseDelimitedProfile,
    parseOSDJson,
    parseSimpleJson
} from '../src';

describe('package metadata', () => {
    const packageRoot = path.join(__dirname, '..');
    const packageJson = JSON.parse(
        readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
    );

    it('resolves the package root to built JavaScript and declarations', () => {
        expect(packageJson.main).toBe('dist/index.js');
        expect(packageJson.types).toBe('dist/index.d.ts');
        expect(packageJson.exports['.']).toEqual({
            types: './dist/index.d.ts',
            require: './dist/index.js',
            import: './dist/index.esm.js',
            default: './dist/index.js'
        });
    });

    it('exposes 3D rendering through an optional subpath', () => {
        expect(packageJson.exports['./three3d']).toEqual({
            types: './dist/render/three3d.d.ts',
            require: './dist/render/three3d.js',
            default: './dist/render/three3d.js'
        });
        expect(packageJson.peerDependenciesMeta.three.optional).toBe(true);
    });

    it('preserves the root 3D export for existing consumers', () => {
        expect(typeof renderInteractive3D).toBe('function');
    });

    it('resolves all export subpaths to files that physically exist on disk', () => {
        if (!existsSync(path.join(packageRoot, 'dist'))) {
            // dist/ not yet compiled (e.g. running jest before build)
            return;
        }

        const expectedSubpaths = [
            '.',
            './static',
            './interactive',
            './core',
            './parsers/osd',
            './parsers/simple',
            './parsers/delimited',
            './umd',
            './three3d'
        ];

        for (const subpath of expectedSubpaths) {
            const exportEntry = packageJson.exports[subpath];
            expect(exportEntry).toBeDefined();

            const conditions = ['types', 'require', 'import', 'default'] as const;
            let checkedConditions = 0;
            for (const condition of conditions) {
                if (exportEntry[condition]) {
                    const filePath = path.resolve(packageRoot, exportEntry[condition]);
                    expect(existsSync(filePath)).toBe(true);
                    checkedConditions++;
                }
            }
            expect(checkedConditions).toBeGreaterThan(0);
        }
    });

    it('re-exports parser classes and helper functions from root barrel', () => {
        expect(typeof DelimitedParser).toBe('function');
        expect(typeof OSDParser).toBe('function');
        expect(typeof SimpleParser).toBe('function');
        expect(typeof parseDelimitedHorizons).toBe('function');
        expect(typeof parseDelimitedProfile).toBe('function');
        expect(typeof parseOSDJson).toBe('function');
        expect(typeof parseSimpleJson).toBe('function');
    });
});

