// Balance simulation: plays bots-only matches of Office Hours in Node on the game's own rules and
// reports how rounds end, how long they take, who wins them, how kills land, and how often the
// charges, the team combos and the closing ring come into play.
//   node tools/balance.mjs [matches, default 20]
import { createWorld, stepWorld } from '../game/src/sim/world.js';
import { TICK } from '../game/src/sim/config.js';

const IDLE = { fwd: 0, side: 0, crouch: false, walk: false, jump: false, fire: false, use: false };

export function playMatch(seed, limitSeconds = 1800) {
  const world = createWorld({ seed, playerTeam: null });
  const stats = { rounds: [], kills: { head: 0, body: 0, other: 0 }, shots: 0, hits: 0, plants: 0, combos: 0, zones: 0, ringKills: 0, bursts: {}, colas: 0, killsBy: {} };
  let roundStart = 0;
  while (world.phase !== 'match' && world.time < limitSeconds) {
    stepWorld(world, IDLE, TICK);
    for (const e of world.events) {
      if (e.type === 'shot') stats.shots++;
      else if (e.type === 'hit') stats.hits++;
      else if (e.type === 'kill') {
        stats.kills[e.killer === null ? 'other' : e.head ? 'head' : 'body']++;
        if (e.finisher === 'ring') stats.ringKills++;
        if (e.killer !== null) {
          const role = world.soldiers[e.killer].role.id;
          stats.killsBy[role] = (stats.killsBy[role] || 0) + 1;
        }
      } else if (e.type === 'planted') stats.plants++;
      else if (e.type === 'combo') stats.combos++;
      else if (e.type === 'burst') stats.bursts[e.kind] = (stats.bursts[e.kind] || 0) + 1;
      else if (e.type === 'cola') stats.colas++;
      else if (e.type === 'dropZone') stats.zones++;
      else if (e.type === 'roundOver' || e.type === 'matchOver') stats.rounds.push({ winner: e.winner, reason: e.reason, seconds: world.time - roundStart });
      else if (e.type === 'roundStart') roundStart = world.time;
    }
    world.events.length = 0;
  }
  return { world, stats, timedOut: world.phase !== 'match' };
}

function main() {
  const n = Number(process.argv[2] || 20);
  const sum = { rounds: 0, seconds: 0, plants: 0, combos: 0, zones: 0, ringKills: 0, shots: 0, hits: 0, timeouts: 0 };
  const wins = { atk: 0, def: 0 };
  const matchWins = { atk: 0, def: 0 };
  const reasons = {};
  const kills = { head: 0, body: 0, other: 0 };
  const bursts = {};
  const killsBy = {};
  let colas = 0;
  for (let i = 0; i < n; i++) {
    const { world, stats, timedOut } = playMatch(100 + i);
    if (timedOut) sum.timeouts++;
    else matchWins[world.winner]++;
    for (const r of stats.rounds) {
      sum.rounds++;
      sum.seconds += r.seconds;
      wins[r.winner]++;
      reasons[`${r.winner}:${r.reason}`] = (reasons[`${r.winner}:${r.reason}`] || 0) + 1;
    }
    for (const k in kills) kills[k] += stats.kills[k];
    for (const k in stats.bursts) bursts[k] = (bursts[k] || 0) + stats.bursts[k];
    for (const k in stats.killsBy) killsBy[k] = (killsBy[k] || 0) + stats.killsBy[k];
    colas += stats.colas;
    for (const k of ['plants', 'combos', 'zones', 'ringKills', 'shots', 'hits']) sum[k] += stats[k];
  }
  console.log(`${n} matches, ${sum.rounds} rounds, ${sum.timeouts} timed out`);
  console.log(`match wins  Gentlemen ${matchWins.atk}  Night Shift ${matchWins.def}`);
  console.log(`round wins  Gentlemen ${wins.atk}  Night Shift ${wins.def}   avg round ${(sum.seconds / Math.max(1, sum.rounds)).toFixed(1)} s`);
  console.log(`how rounds end ${JSON.stringify(reasons)}`);
  console.log(`drop zones ${sum.zones}  plants ${sum.plants}  combos ${sum.combos}  ring kills ${sum.ringKills}`);
  console.log(`grenades ${JSON.stringify(bursts)}  colas drunk ${colas}`);
  console.log(`kills by career ${JSON.stringify(killsBy)}`);
  console.log(`kills ${JSON.stringify(kills)}  accuracy ${((100 * sum.hits) / Math.max(1, sum.shots)).toFixed(1)}% of ${sum.shots} shots`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
