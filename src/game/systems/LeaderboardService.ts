export interface LeaderboardEntry {
  name: string;
  email: string;
  points: number;
}

const LS_KEY = 'spacepunch_leaderboard';
const LS_SEEDED = 'spacepunch_lb_seeded';
const MAX_ENTRIES = 20;

function entryKey(e: { name: string; email: string }): string {
  return `${e.name.trim().toLowerCase()}|${(e.email || '').trim().toLowerCase()}`;
}

function fromStorage(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function toStorage(entries: LeaderboardEntry[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

function mergeEntry(entries: LeaderboardEntry[], entry: LeaderboardEntry): LeaderboardEntry[] {
  const key = entryKey(entry);
  const idx = entries.findIndex(e => entryKey(e) === key);
  if (idx !== -1) {
    if (entry.points > entries[idx].points) entries[idx] = { ...entry };
    else return entries;
  } else {
    entries.push({ ...entry });
  }
  entries.sort((a, b) => b.points - a.points);
  return entries.slice(0, MAX_ENTRIES);
}

function parseSeedTSV(text: string): LeaderboardEntry[] {
  return text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(l => {
      const parts = l.split('\t');
      return { name: parts[0] || '', email: parts[1] || '', points: parseInt(parts[2]) || 0 };
    });
}

export async function loadLeaderboard(): Promise<LeaderboardEntry[]> {
  // Try API (works in dev with Vite plugin)
  try {
    const res = await fetch('/api/leaderboard');
    if (res.ok) return await res.json();
  } catch { /* server unavailable */ }

  // LocalStorage fallback
  let entries = fromStorage();

  // Seed merge on first-ever visit
  if (!localStorage.getItem(LS_SEEDED)) {
    localStorage.setItem(LS_SEEDED, '1');
    try {
      const res = await fetch('./assets/leaderboard.txt');
      if (res.ok) {
        const seeds = parseSeedTSV(await res.text());
        for (const s of seeds) entries = mergeEntry(entries, s);
        toStorage(entries);
      }
    } catch { /* seed file unavailable */ }
  }

  return entries;
}

export async function saveLeaderboardEntry(
  entry: LeaderboardEntry,
): Promise<'server' | 'local'> {
  // Try API
  try {
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (res.ok) return 'server';
  } catch { /* server unavailable */ }

  // LocalStorage fallback
  const entries = mergeEntry(fromStorage(), entry);
  toStorage(entries);
  return 'local';
}
