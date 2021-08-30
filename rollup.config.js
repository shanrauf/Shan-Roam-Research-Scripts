import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
// import nodePolyfills from 'rollup-plugin-polyfill-node';
import nodeGlobals from "rollup-plugin-node-globals";

// `npm run build` -> `production` is true
// `npm start` -> `production` is false
const production = !process.env.ROLLUP_WATCH;

export default {
  input: 'src/main.ts',
  sourcemap: !production,
	output: {
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
	]
};
