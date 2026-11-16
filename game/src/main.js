// Office Hours: boots the page. The title lets you pick a side and a career beside a line-up of
// all six; then the match runs a fixed-step simulation (60 steps a second, apart from the frame
// rate) and draws each frame from your eyes, or a teammate's once you are out.
import { BUY_LIST, TICK } from './sim/config.js';
import { createWorld, stepWorld } from './sim/world.js';
import { createView } from './render/view.js';
import { createHud } from './ui/hud.js';
import { createInput } from './input.js';
import { chargeBeep, playEvents, toggleMute, unlockAudio } from './audio.js';
import { prepareShot } from './shots.js';

const host = document.getElementById('game');
const params = new URLSearchParams(location.search);
const hud = createHud();
const app = {
  world: null,
  view: null,
  mode: 'title', // title, play, paused, end
  pick: { team: params.get('team') || 'def', role: params.get('role') || 'nurse' },
  spectate: 0,
  shot: params.get('shot'),
};

function newMatch(playerTeam, playerRole, seed) {
  app.world = createWorld({ seed: seed || Math.floor(Math.random() * 1e9), playerTeam, playerRole });
  if (!app.view) app.view = createView(host, app.world);
  else app.view.rebind(app.world);
}

// The title: the six careers lined up beside the picker (a bots-only world holds their figures).
newMatch(null, null, 20261116);
hud.buildPicker((team, role) => {
  app.pick = { team, role };
});
document.querySelector(`.role[data-role="${app.pick.role}"]`)?.classList.add('on');

const input = createInput(app.view.renderer.domElement, {
  onLockRequest() {
    if (app.mode === 'play' || app.mode === 'paused') lock();
  },
  onBuy() {
    if (app.mode !== 'play' || !app.world.player) return;
    const open = !hud.buyOpen();
    hud.toggleBuy(app.world, app.world.player, open);
    if (open) document.exitPointerLock();
    else lock();
  },
  onBoard(open) {
    if (app.mode === 'play') hud.toggleBoard(app.world, open);
  },
  onMute: toggleMute,
  onDigit(n) {
    if (hud.buyOpen() && BUY_LIST[n - 1]) buyItem(BUY_LIST[n - 1]);
  },
  onEscape() {
    if (hud.buyOpen()) {
      hud.toggleBuy(app.world, app.world.player, false);
      lock();
    }
  },
});

function lock() {
  app.view.renderer.domElement.requestPointerLock?.();
}

function buyItem(item) {
  app.world.buy(app.world.player, item);
  hud.renderBuy(app.world, app.world.player);
}

hud.buyList.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b && !b.disabled) buyItem(b.dataset.item);
});

document.getElementById('play').addEventListener('click', () => {
  unlockAudio();
  document.getElementById('title').hidden = true;
  newMatch(app.pick.team, app.pick.role);
  hud.showHud(true);
  app.mode = 'play';
  lock();
});
document.getElementById('again').addEventListener('click', () => {
  document.getElementById('end').hidden = true;
  newMatch(app.pick.team, app.pick.role);
  app.mode = 'play';
  lock();
});
document.getElementById('pause').addEventListener('click', () => lock());
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === app.view.renderer.domElement;
  if (app.mode === 'play' && !locked && !hud.buyOpen()) app.mode = 'paused';
  else if (app.mode === 'paused' && locked) app.mode = 'play';
  document.getElementById('pause').hidden = app.mode !== 'paused';
});

/** Whose eyes the frame is drawn from: you, a living teammate once you are out, or a bot on the title. */
function viewer(world) {
  const me = world.player;
  if (me && me.alive) return me;
  const pool = world.soldiers.filter((s) => s.alive && (!me || s.team === me.team));
  if (!pool.length) return me || world.soldiers[0];
  return pool[app.spectate % pool.length];
}

const IDLE = { fwd: 0, side: 0, crouch: false, walk: false, jump: false, fire: false, use: false };
let last = performance.now();
let acc = 0;
let time = 0;

function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  const world = app.world;
  if (app.mode === 'play') {
    acc += dt;
    while (acc >= TICK) {
      const me = world.player;
      const cmd = me && app.mode === 'play' && !hud.buyOpen() ? input.read(me) : IDLE;
      stepWorld(world, cmd, TICK);
      acc -= TICK;
      const events = world.events;
      const eye = viewer(world);
      for (const e of events) {
        if (e.type === 'shot' && me && e.id === me.id && me.gun.def.rpm < 60) input.unscope();
        if (e.type === 'roundStart') input.unscope();
      }
      app.view.react(events, eye, time);
      if (me) {
        hud.react(world, events, eye);
        playEvents(world, events, eye);
      }
      if (events.some((e) => e.type === 'matchOver') && app.mode === 'play') {
        app.mode = 'end';
        document.exitPointerLock();
        setTimeout(() => hud.showEnd(world), 1200);
      }
      events.length = 0;
      time += TICK;
    }
  }
  const eye = viewer(app.world);
  if (app.world.player) {
    hud.update(app.world, eye, dt);
    chargeBeep(app.world, eye, dt);
  }
  if (app.mode === 'title') app.view.renderLineup(time);
  else app.view.render(eye, dt, time);
  requestAnimationFrame(frame);
}

if (app.shot) {
  prepareShot(app, hud, params);
  window.LK_SHOT_READY = true;
} else {
  requestAnimationFrame(frame);
}
