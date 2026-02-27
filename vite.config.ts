import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LB_FILE = resolve(__dirname, 'leaderboard.txt');
const SEED_FILE = resolve(__dirname, 'public/assets/leaderboard.txt');

interface LBEntry { name: string; email: string; points: number; }

function readLB(): LBEntry[] {
  // Bootstrap from seed if writable file is missing
  if (!fs.existsSync(LB_FILE) && fs.existsSync(SEED_FILE)) {
    fs.copyFileSync(SEED_FILE, LB_FILE);
  }
  if (!fs.existsSync(LB_FILE)) return [];
  return fs.readFileSync(LB_FILE, 'utf-8')
    .split('\n').filter(l => l.trim())
    .map(l => {
      const [name = '', email = '', pts = '0'] = l.split('\t');
      return { name, email, points: parseInt(pts) || 0 };
    });
}

function writeLB(entries: LBEntry[]): void {
  const lines = entries.map(e => `${e.name}\t${e.email}\t${e.points}`);
  fs.writeFileSync(LB_FILE, lines.join('\n') + '\n');
}

function leaderboardPlugin(): Plugin {
  return {
    name: 'leaderboard-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/api/leaderboard') return next();

        if (req.method === 'GET') {
          const entries = readLB();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(entries));
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (c: Buffer) => { body += c.toString(); });
          req.on('end', () => {
            try {
              const entry: LBEntry = JSON.parse(body);
              const entries = readLB();
              const key = `${entry.name.trim().toLowerCase()}|${(entry.email || '').trim().toLowerCase()}`;
              const idx = entries.findIndex(e =>
                `${e.name.trim().toLowerCase()}|${(e.email || '').trim().toLowerCase()}` === key
              );
              if (idx !== -1) {
                if (entry.points > entries[idx].points) entries[idx] = entry;
              } else {
                entries.push(entry);
              }
              entries.sort((a, b) => b.points - a.points);
              writeLB(entries.slice(0, 20));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true }));
            } catch {
              res.statusCode = 400;
              res.end('Bad request');
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  plugins: [leaderboardPlugin()],
});
