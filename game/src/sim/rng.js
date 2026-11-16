// Seeded random numbers (mulberry32): the same seed replays the same match, which the screenshot
// scenes and the balance tool rely on.

export function createRng(seed) {
  let state = (seed >>> 0) || 0x2545f491;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (p) => next() < p,
    /** Roughly normal, mean 0, deviation 1. */
    gauss: () => (next() + next() + next() + next() - 2) * 1.7320508,
  };
}
