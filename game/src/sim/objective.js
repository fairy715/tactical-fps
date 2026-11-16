// The round's objective, the same for both sides. Each team carries one glitter charge. No site
// is fixed: where a team loses its first member, the OTHER team gets its drop zone there, and may
// plant its charge in it. The enemy can defuse a planted charge; a charge that goes off wins the
// round. The closing ring keeps things moving: it closes on the first drop zone (so whoever drew
// first blood has to push), pauses when the second zone appears (the sides are level again), then
// closes on the point between the two zones, never so far that either zone falls outside it.
import { ECONOMY, RING, ROUND } from './config.js';
import { killSoldier } from './combat.js';

export const enemyOf = (team) => (team === 'atk' ? 'def' : 'atk');

function freshBomb(team) {
  return { team, state: 'carried', carrier: null, x: 0, y: 0, z: 0, timer: 0, plant: 0, defuse: 0, defuser: null, planter: null };
}

/** Sets up a round: both charges handed to a random member of each team, no zones, no ring. */
export function resetObjective(world) {
  world.bombs = { atk: freshBomb('atk'), def: freshBomb('def') };
  world.dropZones = { atk: null, def: null };
  world.ring = null;
  for (const team of ['atk', 'def']) {
    const squad = world.soldiers.filter((s) => s.team === team);
    const carrier = squad[world.rng.int(0, squad.length - 1)];
    carrier.hasBomb = true;
    world.bombs[team].carrier = carrier.id;
  }
}

/** Whether a soldier stands in its own team's drop zone, on the same floor (a tower deck counts). */
export function inDropZone(world, s) {
  const z = world.dropZones[s.team];
  return !!z && Math.hypot(z.x - s.pos.x, z.z - s.pos.z) < ROUND.siteRadius && Math.abs(z.y - s.pos.y) < 1.5;
}

export function plantedBombs(world) {
  return [world.bombs.atk, world.bombs.def].filter((b) => b.state === 'planted');
}

export function dropBomb(world, s) {
  s.hasBomb = false;
  Object.assign(world.bombs[s.team], { state: 'dropped', carrier: null, x: s.pos.x, y: s.pos.y, z: s.pos.z });
  world.events.push({ type: 'bombDropped', team: s.team, x: s.pos.x, z: s.pos.z });
}

/** A teammate walking over a dropped charge picks it up. */
export function pickUpBombs(world) {
  for (const team of ['atk', 'def']) {
    const bomb = world.bombs[team];
    if (bomb.state !== 'dropped') continue;
    const s = world.soldiers.find((o) => o.team === team && o.alive && Math.hypot(o.pos.x - bomb.x, o.pos.z - bomb.z) < 1.3);
    if (!s) continue;
    s.hasBomb = true;
    bomb.state = 'carried';
    bomb.carrier = s.id;
    world.events.push({ type: 'bombTaken', id: s.id, team });
  }
}

/** Where a team first loses someone, the other team's drop zone appears. */
export function markDropZones(world) {
  for (const e of world.events) {
    if (e.type !== 'kill') continue;
    const v = world.soldiers[e.victim];
    const team = enemyOf(v.team);
    if (world.dropZones[team]) continue;
    world.dropZones[team] = { team, x: v.pos.x, y: v.pos.y, z: v.pos.z, victim: v.id };
    world.events.push({ type: 'dropZone', team, x: v.pos.x, y: v.pos.y, z: v.pos.z, victim: v.id });
    onZoneForRing(world);
  }
}

/** Arms, pauses or re-centres the ring as drop zones appear. */
function onZoneForRing(world) {
  const zones = [world.dropZones.atk, world.dropZones.def].filter(Boolean);
  if (zones.length === 1) {
    world.ring = { x: zones[0].x, z: zones[0].z, r: RING.startRadius, minR: RING.endRadius, startAt: world.time + RING.delay };
    world.events.push({ type: 'ringArmed', startAt: world.ring.startAt });
    return;
  }
  // Both zones out: the sides are level, so the ring pauses, then closes between them.
  const [a, b] = zones;
  const ring = world.ring;
  const half = Math.hypot(a.x - b.x, a.z - b.z) / 2;
  ring.x = (a.x + b.x) / 2;
  ring.z = (a.z + b.z) / 2;
  ring.minR = Math.max(RING.endRadius, half + 7);
  ring.r = Math.max(ring.r, ring.minR + 4);
  ring.startAt = Math.max(ring.startAt, world.time + RING.pause);
  world.events.push({ type: 'ringPaused', until: ring.startAt });
}

/** The ring closes once its wait is over; whoever is outside it burns, on either side. */
export function updateRing(world, dt) {
  if (!world.ring && ROUND.live - world.phaseTime >= RING.fallback) {
    world.ring = { x: 0, z: 0, r: RING.startRadius, minR: RING.endRadius, startAt: world.time };
    world.events.push({ type: 'ringArmed', startAt: world.time });
  }
  const ring = world.ring;
  if (!ring || world.time < ring.startAt) return;
  ring.r = Math.max(ring.minR, ring.r - ((RING.startRadius - RING.endRadius) / RING.shrink) * dt);
  for (const s of world.soldiers) {
    if (!s.alive || Math.hypot(s.pos.x - ring.x, s.pos.z - ring.z) <= ring.r) continue;
    s.health -= RING.dps * dt;
    s.outside = true;
    if (s.health <= 0) killSoldier(world, s, null, false, 'ring');
  }
}

/**
 * Planting and defusing: hold the use key, stand still, keep at it. Returns a round result when a
 * defuse finishes, else null.
 */
export function useAction(world, s, using, dt) {
  const mine = world.bombs[s.team];
  const theirs = world.bombs[enemyOf(s.team)];
  s.action = null;
  if (!using || !s.onGround) {
    if (theirs.defuser === s.id) {
      theirs.defuser = null;
      theirs.defuse = 0;
    }
    if (s.hasBomb) mine.plant = 0;
    return null;
  }
  if (s.hasBomb && world.phase === 'live' && inDropZone(world, s)) {
    s.action = 'plant';
    mine.plant += dt;
    if (mine.plant >= ROUND.plantTime) {
      s.hasBomb = false;
      Object.assign(mine, { state: 'planted', carrier: null, x: s.pos.x, y: s.pos.y, z: s.pos.z, timer: ROUND.bombTimer, planter: s.id });
      s.money = Math.min(ECONOMY.max, s.money + ECONOMY.plantBonus);
      world.events.push({ type: 'planted', team: s.team, by: s.id, x: s.pos.x, z: s.pos.z });
    }
    return null;
  }
  if (theirs.state === 'planted' && Math.hypot(theirs.x - s.pos.x, theirs.z - s.pos.z) < 1.6) {
    if (theirs.defuser !== null && theirs.defuser !== s.id) return null;
    s.action = 'defuse';
    theirs.defuser = s.id;
    theirs.defuse += dt;
    if (theirs.defuse >= ROUND.defuseTime) {
      theirs.state = 'defused';
      s.money = Math.min(ECONOMY.max, s.money + ECONOMY.defuseBonus);
      world.events.push({ type: 'defused', team: theirs.team, by: s.id });
      return { winner: s.team, reason: 'defused' };
    }
  }
  return null;
}

/**
 * Counts planted charges down and decides the round: a charge going off wins it; a side wiped out
 * loses it unless its own charge is still ticking (then the other side must defuse in time); when
 * the clock runs out with nothing planted, the side with more standing (then more health) wins.
 */
export function checkRound(world, dt) {
  for (const bomb of plantedBombs(world)) {
    bomb.timer -= dt;
    if (bomb.timer > 0) continue;
    bomb.state = 'detonated';
    world.events.push({ type: 'detonated', team: bomb.team, x: bomb.x, z: bomb.z });
    for (const s of world.soldiers) {
      if (s.alive && s.team !== bomb.team && Math.hypot(s.pos.x - bomb.x, s.pos.z - bomb.z) < 9) killSoldier(world, s, null, false);
    }
    return { winner: bomb.team, reason: 'detonated' };
  }
  const standing = (team) => world.soldiers.filter((s) => s.team === team && s.alive);
  for (const team of ['atk', 'def']) {
    if (standing(team).length === 0 && world.bombs[team].state !== 'planted') return { winner: enemyOf(team), reason: 'eliminated' };
  }
  if (world.phaseTime <= 0 && plantedBombs(world).length === 0) {
    const a = standing('atk');
    const d = standing('def');
    const hp = (list) => list.reduce((sum, s) => sum + s.health, 0);
    const atkAhead = a.length > d.length || (a.length === d.length && hp(a) > hp(d));
    return { winner: atkAhead ? 'atk' : 'def', reason: 'time' };
  }
  return null;
}
