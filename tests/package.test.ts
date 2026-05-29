import { readFileSync } from 'fs';
import path from 'path';
import { renderInteractive3D } from '../src';

describe('package metadata', () => {
    const packageJson = JSON.parse(
        readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
    );

    it('resolves the package root to built JavaScript and declarations', () => {
        expect(packageJson.main).toBe('dist/index.js');
        expect(packageJson.types).toBe('dist/index.d.ts');
        expect(packageJson.exports['.']).toEqual({
            types: './dist/index.d.ts',
            require: './dist/index.js',
            default: './dist/index.js'
        });
    });

    it('exposes 3D rendering through an optional subpath', () => {
        expect(packageJson.exports['./three3d']).toEqual({
            types: './dist/render/three3d.d.ts',
            require: './dist/render/three3d.js',
            default: './dist/render/three3d.js'
        });
        expect(packageJson.peerDependencies.three).toBe('^0.184.0');
        expect(packageJson.peerDependenciesMeta.three.optional).toBe(true);
    });

    it('preserves the root 3D export for existing consumers', () => {
        expect(typeof renderInteractive3D).toBe('function');
    });
});
