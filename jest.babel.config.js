/** Babel config only for Jest (see jest.config.js). Next.js uses SWC and does not load this. */
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
};
