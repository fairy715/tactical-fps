// The HUD and menus, as DOM over the canvas: score and clock, the minimap, the kill feed (written
// as a clash of careers), vitals, ammo, crosshair and scope, banners, the plant/defuse bar, the buy
// menu, the scoreboard, the title's career picker and the match-over table.
import { BUY_LIST, GEAR, GRENADES, GRENADE_MAX, MATCH, MODELS, ROLES, ROLE_ORDER, ROUND, TEAMS } from '../sim/config.js';
import { BOUNDS, SOLIDS } from '../sim/map.js';
import { inDropZone, plantedBombs } from '../sim/world.js';
import { currentSpread } from '../sim/weapons.js';
import { GAG_VERBS } from '../render/finishers.js';

const $ = (id) => document.getElementById(id);

function fmtClock(t) {
  const s = Math.max(0, Math.ceil(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const REASONS = {
  eliminated: 'last one standing',
  time: 'time ran out',
  detonated: 'the glitter charge went off',
  defused: 'the charge was defused',
};

export function createHud() {
  const el = {
    hud: $('hud'), timer: $('timer'), phase: $('phase'), clock: $('clock'), scoreAtk: $('score-atk'), scoreDef: $('score-def'),
    pipsAtk: $('pips-atk'), pipsDef: $('pips-def'), money: $('money-value'), feed: $('feed'), hp: $('hp'), hpBar: $('hp-bar'),
    armor: $('armor'), armorBar: $('armor-bar'), gunName: $('gun-name'), ammo: $('ammo'), mag: $('mag'), reserve: $('reserve'),
    grenades: $('grenades'), grenadeName: $('grenade-name'), status: $('status'), crosshair: $('crosshair'), hitmarker: $('hitmarker'), scope: $('scope'),
    damage: $('damage'), flashout: $('flashout'), hint: $('hint'), progress: $('progress'), progressLabel: $('progress-label'),
    progressBar: $('progress-bar'), banner: $('banner'), bannerTitle: $('banner-title'), bannerSub: $('banner-sub'),
    spectate: $('spectate'), buy: $('buy'), buyList: $('buy-list'), buyMoney: $('buy-money'), buyNote: $('buy-note'),
    board: $('board'), boardTable: $('board-table'), end: $('end'), endTitle: $('end-title'), endKicker: $('end-kicker'), endTable: $('end-table'),
  };
  const map = $('minimap').getContext('2d');
  let bannerTime = 0;
  let hitTime = 0;
  const heard = new Map(); // enemy id -> time they last fired

  function toMap(x, z) {
    const w = 240;
    const h = 184;
    return [((x - BOUNDS.x0) / (BOUNDS.x1 - BOUNDS.x0)) * w, ((z - BOUNDS.z0) / (BOUNDS.z1 - BOUNDS.z0)) * h];
  }

  function drawMinimap(world, viewer) {
    map.clearRect(0, 0, 240, 184);
    for (const b of SOLIDS) {
      if (b.kind === 'perimeter' || b.kind === 'step') continue;
      const [x0, z0] = toMap(b.x0, b.z0);
      const [x1, z1] = toMap(b.x1, b.z1);
      map.fillStyle = b.kind === 'tower' ? '#f2c230' : b.h > 3 ? 'rgba(220,210,195,0.55)' : 'rgba(220,210,195,0.3)';
      map.fillRect(x0, z0, Math.max(1, x1 - x0), Math.max(1, z1 - z0));
    }
    const ring = world.ring;
    if (ring) {
      const [x, z] = toMap(ring.x, ring.z);
      map.strokeStyle = '#7f9cff';
      map.lineWidth = 2;
      map.beginPath();
      map.arc(x, z, (ring.r / (BOUNDS.x1 - BOUNDS.x0)) * 240, 0, Math.PI * 2);
      map.stroke();
    }
    for (const team of ['atk', 'def']) {
      const zone = world.dropZones[team];
      if (!zone) continue;
      const [x, z] = toMap(zone.x, zone.z);
      map.strokeStyle = TEAMS[team].color;
      map.lineWidth = 2.5;
      map.beginPath();
      map.arc(x, z, (ROUND.siteRadius / (BOUNDS.x1 - BOUNDS.x0)) * 240, 0, Math.PI * 2);
      map.stroke();
    }
    for (const s of world.soldiers) {
      if (!s.alive) continue;
      const friend = s.team === viewer.team;
      const recent = heard.get(s.id);
      if (!friend && !(recent && world.time - recent < 2)) continue;
      const [x, z] = toMap(s.pos.x, s.pos.z);
      map.fillStyle = TEAMS[s.team].color;
      map.beginPath();
      map.arc(x, z, s === viewer ? 4.5 : 3.5, 0, Math.PI * 2);
      map.fill();
      if (friend) {
        map.strokeStyle = '#fff';
        map.beginPath();
        map.moveTo(x, z);
        map.lineTo(x - Math.sin(s.yaw) * 9, z - Math.cos(s.yaw) * 9);
        map.stroke();
      }
    }
    for (const team of ['atk', 'def']) {
      const bomb = world.bombs[team];
      if (bomb.state !== 'dropped' && bomb.state !== 'planted') continue;
      const [x, z] = toMap(bomb.x, bomb.z);
      map.fillStyle = bomb.state === 'planted' ? '#ff3355' : TEAMS[team].color;
      map.fillRect(x - 3.5, z - 3.5, 7, 7);
    }
  }

  function banner(title, sub, seconds = 3) {
    el.bannerTitle.textContent = title;
    el.bannerSub.textContent = sub;
    el.banner.hidden = false;
    bannerTime = seconds;
  }

  function feedLine(world, e) {
    const victim = world.soldiers[e.victim];
    const killer = e.killer === null ? null : world.soldiers[e.killer];
    const li = document.createElement('li');
    if (killer && (killer.isPlayer || victim.isPlayer)) li.className = 'mine';
    const k = killer ? `<span class="${killer.team}">${killer.name}</span>` : e.finisher === 'ring' ? '<span class="how">The closing ring</span>' : '<span class="atk">The glitter charge</span>';
    li.innerHTML = `${k}<span class="how">${GAG_VERBS[e.finisher || 'blast'] || e.finisher}${e.head ? ' · head' : ''}</span><span class="${victim.team}">${victim.name}</span>`;
    el.feed.prepend(li);
    while (el.feed.children.length > 5) el.feed.lastChild.remove();
    setTimeout(() => li.remove(), 7000);
  }

  /** Reacts to the step's events: feed, banners, hit markers. */
  function react(world, events, viewer) {
    for (const e of events) {
      if (e.type === 'kill') feedLine(world, e);
      else if (e.type === 'shot' && world.soldiers[e.id].team !== viewer.team) heard.set(e.id, world.time);
      else if (e.type === 'hit' && e.shooter === viewer.id) {
        hitTime = 0.18;
        el.hitmarker.classList.toggle('head', e.head);
      } else if (e.type === 'hit' && e.victim === viewer.id) el.damage.style.opacity = '1';
      else if (e.type === 'live') banner('Go go go', `${TEAMS[viewer.team].name}: ${TEAMS[viewer.team].role}`, 2);
      else if (e.type === 'planted') banner(`${TEAMS[e.team].name} planted their charge!`, e.team === viewer.team ? `Hold it for ${ROUND.bombTimer} seconds` : `${ROUND.bombTimer} seconds to defuse it`, 3);
      else if (e.type === 'dropZone') banner(`${TEAMS[e.team].name} drop zone marked`, `Where ${world.soldiers[e.victim].name} fell, ${TEAMS[e.team].name} can plant`, 3);
      else if (e.type === 'ringPaused') banner('Both drop zones are out', 'The ring holds for 15 seconds, then closes between them', 3);
      else if (e.type === 'combo') banner(`${e.name.toUpperCase()}!`, e.team === 'def' ? 'Chalk, flash and sedative together: everyone near it is stunned' : 'Coins, roses and flames together: armour and gear confiscated', 3);
      else if (e.type === 'roundOver') banner(`${e.teamName} take the round`, REASONS[e.reason], 4);
      else if (e.type === 'roundStart') {
        banner(`Round ${e.round}`, 'Buy with B · the round goes live when the clock runs out', 3);
        el.feed.innerHTML = '';
      }
    }
  }

  function update(world, viewer, dt) {
    const me = world.player || viewer;
    el.scoreAtk.textContent = world.score.atk;
    el.scoreDef.textContent = world.score.def;
    for (const team of ['atk', 'def']) {
      const pips = team === 'atk' ? el.pipsAtk : el.pipsDef;
      const squad = world.soldiers.filter((s) => s.team === team);
      if (pips.children.length !== squad.length) pips.innerHTML = squad.map(() => '<i></i>').join('');
      squad.forEach((s, i) => pips.children[i].classList.toggle('dead', !s.alive));
    }
    // The clock shows the soonest planted charge while one ticks.
    const ticking = plantedBombs(world).sort((a, b) => a.timer - b.timer)[0];
    const planted = !!ticking && world.phase === 'live';
    el.timer.textContent = fmtClock(planted ? ticking.timer : world.phase === 'over' || world.phase === 'match' ? 0 : world.phaseTime);
    const ring = world.ring;
    const ringNote = ring && world.phase === 'live' ? (world.time < ring.startAt ? `RING IN ${Math.ceil(ring.startAt - world.time)}S` : 'RING CLOSING') : null;
    el.phase.textContent = planted ? `${TEAMS[ticking.team].short} CHARGE` : ringNote || { freeze: 'BUY', live: 'LIVE', over: 'ROUND OVER', match: 'MATCH OVER' }[world.phase];
    el.clock.classList.toggle('planted', planted);
    el.money.textContent = me.money;
    el.hp.textContent = Math.max(0, Math.round(viewer.health));
    el.hpBar.style.width = `${Math.max(0, viewer.health)}%`;
    el.armor.textContent = Math.round(viewer.armor);
    el.armorBar.style.width = `${viewer.armor}%`;
    const gun = viewer.gun;
    el.gunName.textContent = `${viewer.role.gun} · ${gun.def.name}${gun.reloading > 0 ? ' · reloading' : ''}`;
    el.mag.textContent = gun.mag;
    el.reserve.textContent = `/ ${gun.reserve}`;
    el.ammo.classList.toggle('empty', gun.mag === 0);
    el.grenadeName.textContent = GRENADES[viewer.role.id].name;
    el.grenades.textContent = viewer.grenades;
    el.status.textContent = viewer.outside ? 'Outside the ring: get in!' : viewer.stunned > 0 ? 'Stunned by a team combo!' : viewer.charmed > 0 ? 'Charmed: you cannot bring yourself to shoot' : viewer.slowed > 0 ? 'Sedated: slow, no scope' : viewer.burning > 0 ? 'On fire: get out of the flames' : viewer.boosted > 0 ? 'On the milk: faster, and healing' : '';
    // The crosshair opens with the spread.
    const gap = 6 + Math.min(60, currentSpread(viewer) * 900);
    const arms = el.crosshair.children;
    arms[0].style.top = `${-gap - 9}px`;
    arms[1].style.top = `${gap}px`;
    arms[2].style.left = `${-gap - 9}px`;
    arms[3].style.left = `${gap}px`;
    el.crosshair.style.display = viewer.scoped ? 'none' : '';
    el.scope.hidden = !viewer.scoped;
    hitTime = Math.max(0, hitTime - dt);
    el.hitmarker.classList.toggle('on', hitTime > 0);
    el.damage.style.opacity = String(Math.max(0, Number(el.damage.style.opacity || 0) - dt * 1.5));
    el.flashout.style.opacity = String(Math.min(1, viewer.blind / 1.6));
    // Hints and the action bar.
    const mine = world.bombs[me.team];
    const theirs = world.bombs[me.team === 'atk' ? 'def' : 'atk'];
    let hint = '';
    if (viewer === me && me.alive) {
      if (theirs.state === 'planted' && Math.hypot(theirs.x - me.pos.x, theirs.z - me.pos.z) < 1.6) hint = 'Hold E to defuse their charge';
      else if (theirs.state === 'planted') hint = 'Their charge is ticking: find it and defuse it';
      else if (me.hasBomb && inDropZone(world, me) && world.phase === 'live') hint = 'Hold E to plant your charge';
      else if (me.hasBomb) hint = world.dropZones[me.team] ? 'Carry your charge to your drop zone' : 'You carry the charge: take one of them down to mark where it goes';
      else if (world.phase === 'live' && !world.dropZones[me.team]) hint = 'Take one of them down: where they fall, your team can plant';
      if (world.phase === 'freeze') hint = 'Press B to buy';
    }
    el.hint.textContent = hint;
    const acting = viewer.action;
    el.progress.hidden = !acting;
    if (acting) {
      el.progressLabel.textContent = acting === 'plant' ? 'Planting the charge' : 'Defusing';
      const share = acting === 'plant' ? mine.plant / ROUND.plantTime : theirs.defuse / ROUND.defuseTime;
      el.progressBar.style.width = `${Math.min(100, share * 100)}%`;
    }
    el.spectate.hidden = me.alive || viewer === me;
    if (!me.alive && viewer !== me) el.spectate.textContent = `Watching ${viewer.name} · you are out this round`;
    bannerTime -= dt;
    if (bannerTime <= 0) el.banner.hidden = true;
    drawMinimap(world, viewer);
  }

  // ---- buy menu ----------------------------------------------------------------------------

  function itemLabel(s, id) {
    if (MODELS[id]) return [`${s.role.gun} · ${MODELS[id].name}`, `${MODELS[id].dmg} dmg · ${MODELS[id].mag} rounds · ${MODELS[id].zoom}x scope`, MODELS[id].price];
    if (id === 'grenade') {
      const g = GRENADES[s.role.id];
      return [g.name, `${g.note} · carry ${GRENADE_MAX}`, g.price];
    }
    return [GEAR.vest.name, 'Armour: soaks what a rifle does not penetrate', GEAR.vest.price];
  }

  function renderBuy(world, s) {
    el.buyMoney.textContent = `$${s.money}`;
    el.buyNote.textContent = world.phase === 'freeze' ? `Buying closes in ${Math.ceil(world.phaseTime)} s` : 'Buying is closed: the round is live';
    el.buyList.innerHTML = '';
    BUY_LIST.forEach((id, i) => {
      const [name, note, price] = itemLabel(s, id);
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.item = id;
      const owned = (MODELS[id] && s.gun.def === MODELS[id]) || (id === 'vest' && s.armor >= 100) || (id === 'grenade' && s.grenades >= GRENADE_MAX);
      button.disabled = world.phase !== 'freeze' || owned || s.money < price;
      button.innerHTML = `<span class="key">${i + 1}</span><span>${name}<small>${owned ? 'carried' : note}</small></span><span class="price">$${price}</span>`;
      el.buyList.appendChild(button);
    });
  }

  function scoreTable(world, table) {
    const rows = world.soldiers.slice().sort((a, b) => (a.team === b.team ? b.kills - a.kills : a.team === 'atk' ? -1 : 1));
    table.innerHTML = `<tr><th>Career</th><th>Rifle</th><th class="num">Kills</th><th class="num">Heads</th><th class="num">Deaths</th><th class="num">Money</th></tr>${rows
      .map((s) => `<tr class="${s.team}${s.isPlayer ? ' me' : ''}"><td>${s.name}${s.isPlayer ? ' (you)' : ''}</td><td>${s.role.gun}</td><td class="num">${s.kills}</td><td class="num">${s.headshots}</td><td class="num">${s.deaths}</td><td class="num">$${s.money}</td></tr>`)
      .join('')}`;
  }

  function showEnd(world) {
    const playerWon = world.player && world.player.team === world.winner;
    el.endKicker.textContent = world.player ? (playerWon ? 'Victory' : 'Defeat') : 'Match over';
    el.endTitle.textContent = `${TEAMS[world.winner].name} win ${world.score[world.winner]} to ${world.score[world.winner === 'atk' ? 'def' : 'atk']}`;
    scoreTable(world, el.endTable);
    el.end.hidden = false;
  }

  /** Fills the title's career picker; onPick(team, roleId) when one is chosen. */
  function buildPicker(onPick) {
    $('kicker').textContent = `A three.js sniper standoff · ${MATCH.teamSize} v ${MATCH.teamSize} · first to ${ROUND.winsToTake} rounds`;
    for (const team of ['atk', 'def']) {
      const list = $(`roles-${team}`);
      for (const roleId of ROLE_ORDER[team]) {
        const r = ROLES[roleId];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'role';
        b.dataset.team = team;
        b.dataset.role = roleId;
        b.innerHTML = `<i class="face" style="background: radial-gradient(circle at 50% 38%, ${r.skin} 0 34%, ${r.hair} 35% 48%, ${r.suit} 49%)"></i><span><b>${r.name}</b><span>${r.gun} rifle · ${GRENADES[roleId].name} · finisher: ${GAG_VERBS[r.finisher] || r.finisher}</span></span>`;
        b.addEventListener('click', () => {
          document.querySelectorAll('.role').forEach((x) => x.classList.remove('on'));
          b.classList.add('on');
          onPick(team, roleId);
        });
        list.appendChild(b);
      }
    }
  }

  return {
    react,
    update,
    banner,
    renderBuy,
    showEnd,
    buildPicker,
    showHud(on) {
      el.hud.hidden = !on;
    },
    toggleBuy(world, s, open) {
      el.buy.hidden = !open;
      if (open) renderBuy(world, s);
    },
    buyOpen: () => !el.buy.hidden,
    buyList: el.buyList,
    toggleBoard(world, open) {
      el.board.hidden = !open;
      if (open) scoreTable(world, el.boardTable);
    },
  };
}
