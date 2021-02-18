import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import sizes from 'rollup-plugin-sizes';

module.exports = {
  input: 'src/index.js',
  plugins: [
    resolve(),
    commonjs(),
    terser(),
    sizes(),
  ],
  output: {
    file: 'lib/index.js',
    format: 'umd',
    name: 'LGE',
  },
};
