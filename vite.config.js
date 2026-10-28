// `npm run dev` serves the client; run `npm run serve` alongside it for online rooms.
import fs from 'node:fs';

// writes sw.js with every file of this build, so a phone keeps the game and plays it with no network
const offline = {
  name: 'offline',
  apply: 'build',
  generateBundle(_, bundle) {
    const files = ['./', ...Object.keys(bundle).filter(f => f !== 'index.html'), ...fs.readdirSync('public')];
    const source = fs.readFileSync('src/sw.js', 'utf8').replace('__FILES__', JSON.stringify(files)).replace('__CACHE__', JSON.stringify('tycoon-' + Date.now()));
    this.emitFile({ type: 'asset', fileName: 'sw.js', source });
  },
};

export default {
  base: './', // relative, so the same build also runs from a sub-folder such as GitHub Pages
  plugins: [offline],
  server: { host: true, proxy: { '/ws': { target: 'ws://localhost:8080', ws: true } } },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
};
