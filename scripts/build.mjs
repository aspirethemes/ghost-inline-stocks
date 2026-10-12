import {build} from 'esbuild';
import {mkdir, copyFile} from 'node:fs/promises';
await mkdir('dist', {recursive: true});
for (const minify of [false, true]) await build({entryPoints: ['src/browser.js'], bundle: true,
  format: 'iife', target: 'es2020', minify, outfile: `dist/inline-stocks${minify ? '.min' : ''}.js`});
await build({entryPoints: ['src/inline-stocks.js'], bundle: true, format: 'esm', target: 'es2020', outfile: 'dist/inline-stocks.module.js'});
await copyFile('src/inline-stocks.css', 'dist/inline-stocks.css');
