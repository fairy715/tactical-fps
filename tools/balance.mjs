// Balance simulation: plays bots-only matches of Office Hours in Node on the game's own rules and
// reports how rounds end, how long they take, who wins them and how kills land.
//   node tools/balance.mjs [matches, default 20]
import { createWorld, stepWorld } from '../game/src/sim/world.js';
import { TICK } from '../game/src/sim/config.js';

const IDLE = { fwd: 0, side: 0, crouch: false, walk: false, jump: false, fire: false, use: false };

export function playMatch(seed, limitSeconds = 1800) {
  const world = createWorld({ seed, playerTeam: null });
  const rounds = [];
  let roundStart = 0;
  const kills = { head: 0, body: 0, bomb: 0 };
  let shots = 0;
  let hits = 0;
  while (world.phase !== 'match' && world.time < limitSeconds) {
    stepWorld(world, IDLE, TICK);
    for (const e of world.events) {
      if (e.type === 'shot') shots++;
      if (e.type === 'hit') hits++;
      if (e.type === 'kill') kills[e.killer === null ? 'bomb' : e.head ? 'head' : 'body']++;
      if (e.type === 'roundOver' || e.type === 'matchOver') {
        rounds.push({ winner: e.winner, reason: e.reason, seconds: world.time - roundStart });
      }
      if (e.type === 'roundStart') roundStart = world.time;
    }
    world.events.length = 0;
  }
  return { world, rounds, kills, shots, hits, timedOut: world.phase !== 'match' };
}

function main() {
  const n = Number(process.argv[2] || 20);
  const reasons = {};
  const wins = { atk: 0, def: 0 };
  let roundCount = 0;
  let roundSeconds = 0;
  let matchWins = { atk: 0, def: 0 };
  const kills = { head: 0, body: 0, bomb: 0 };
  let shots = 0;
  let hits = 0;
  let timeouts = 0;
  for (let i = 0; i < n; i++) {
    const r = playMatch(100 + i);
    if (r.timedOut) timeouts++;
    else matchWins[r.world.winner]++;
    for (const round of r.rounds) {
      roundCount++;
      roundSeconds += round.seconds;
      wins[round.winner]++;
      reasons[`${round.winner}:${round.reason}`] = (reasons[`${round.winner}:${round.reason}`] || 0) + 1;
    }
    for (const k in kills) kills[k] += r.kills[k];
    shots += r.shots;
    hits += r.hits;
  }
  console.log(`${n} matches, ${roundCount} rounds, ${timeouts} timed out`);
  console.log(`match wins  Gentlemen ${matchWins.atk}  Night Shift ${matchWins.def}`);
  console.log(`round wins  Gentlemen ${wins.atk}  Night Shift ${wins.def}   avg round ${(roundSeconds / Math.max(1, roundCount)).toFixed(1)} s`);
  console.log(`how rounds end ${JSON.stringify(reasons)}`);
  console.log(`kills ${JSON.stringify(kills)}  accuracy ${((100 * hits) / Math.max(1, shots)).toFixed(1)}% of ${shots} shots`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
