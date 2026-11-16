// Route finding for the bots: A* over the map's waypoint graph, entering it at the nearest
// waypoint the soldier can walk to in a straight line and leaving it for the exact goal.
import { LINKS, NODES } from './map.js';
import { lineOfSight } from './collision.js';

const ids = Object.keys(NODES);
const pos = Object.fromEntries(ids.map((id) => [id, { x: NODES[id][0], y: NODES[id][2] + 1, z: NODES[id][1], floor: NODES[id][2] }]));
const adj = Object.fromEntries(ids.map((id) => [id, []]));
for (const [a, b] of LINKS) {
  adj[a].push(b);
  adj[b].push(a);
}

const from = { x: 0, y: 1, z: 0 };

export function nodePos(id) {
  return pos[id];
}

/** The nearest waypoint reachable in a straight line from (x, z) at floor height floorY. */
export function nearestNode(x, z, floorY = 0) {
  from.x = x;
  from.y = floorY + 1;
  from.z = z;
  let best = null;
  let bestD = Infinity;
  let fallback = null;
  let fallbackD = Infinity;
  for (const id of ids) {
    const p = pos[id];
    const d = Math.hypot(p.x - x, p.z - z) + Math.abs(p.floor - floorY) * 3;
    if (d < fallbackD) {
      fallbackD = d;
      fallback = id;
    }
    if (d < bestD && lineOfSight(from, p, null)) {
      bestD = d;
      best = id;
    }
  }
  return best || fallback;
}

/** Waypoint ids from start to goal, both included, by A*. */
export function findPath(start, goal) {
  if (start === goal) return [start];
  const open = new Set([start]);
  const came = {};
  const g = { [start]: 0 };
  const f = { [start]: dist(start, goal) };
  while (open.size) {
    let cur = null;
    for (const id of open) if (cur === null || f[id] < f[cur]) cur = id;
    if (cur === goal) {
      const path = [cur];
      while (came[cur]) {
        cur = came[cur];
        path.unshift(cur);
      }
      return path;
    }
    open.delete(cur);
    for (const next of adj[cur]) {
      const score = g[cur] + dist(cur, next);
      if (g[next] === undefined || score < g[next]) {
        came[next] = cur;
        g[next] = score;
        f[next] = score + dist(next, goal);
        open.add(next);
      }
    }
  }
  return [start, goal];
}

function dist(a, b) {
  return Math.hypot(pos[a].x - pos[b].x, pos[a].z - pos[b].z);
}

/**
 * Points to walk from (x, z, floor y) to (tx, tz, floor ty): straight there when the way is clear
 * and level, otherwise along the graph. Optional via: waypoint ids to pass through first, in order.
 */
export function planRoute(x, z, y, tx, tz, ty, via) {
  const points = [];
  from.x = x;
  from.y = y + 1;
  from.z = z;
  const target = { x: tx, y: ty + 1, z: tz };
  if (!via && Math.abs(ty - y) < 0.6 && lineOfSight(from, target, null)) return [{ x: tx, z: tz }];
  let cur = nearestNode(x, z, y);
  const stops = (via || []).concat([nearestNode(tx, tz, ty)]);
  for (const stop of stops) {
    const leg = findPath(cur, stop);
    for (const id of leg) {
      const p = pos[id];
      const last = points[points.length - 1];
      if (!last || last.id !== id) points.push({ x: p.x, z: p.z, id });
    }
    cur = stop;
  }
  points.push({ x: tx, z: tz });
  return points;
}
