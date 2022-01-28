import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
// import nodePolyfills from 'rollup-plugin-polyfill-node';
import nodeGlobals from "rollup-plugin-node-globals";
import { terser } from "rollup-plugin-terser";

// `npm run build` -> `production` is true
// `npm start` -> `production` is false
const production = process.env.NODE_ENV == "production";

export default {
  input: 'src/main.ts',
	output: {
		sourcemap: !production,
		dir: 'build',
    format: 'iife',
	},
	plugins: [
		commonjs(),
		nodeResolve({
			browser: true
		}),
		nodeGlobals(),
		json(),
		typescript({
      sourceMap: !production,
      inlineSources: !production
		}),
		production && terser()
	]
};
