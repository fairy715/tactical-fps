// The screenshot scenes behind ?shot=start|play|buy|end. Each plays the real rules forward from a
// fixed seed (the player's career driven by a bot brain), so the frame is what that moment of a
// real match looks like and the same address always gives the same frame.
//   start: the title over a bots-only match          (&t= seconds)
//   play:  a moment of a match from your eyes        (&team= &role= &seed= &t=)
//   buy:   the buy menu at the start of round 2      (&team= &role= &seed=)
//   end:   the match-over table of a whole match     (&team= &role= &seed=)
import { TICK } from './sim/config.js';
import { createBrain } from './sim/bots.js';
import { createWorld, stepWorld } from './sim/world.js';

const IDLE = { fwd: 0, side: 0, crouch: false, walk: false, jump: false, fire: false, use: false };

function run(app, hud, seconds, until) {
  const world = app.world;
  let time = 0;
  const steps = Math.round(seconds / TICK);
  for (let i = 0; i < steps; i++) {
    stepWorld(world, IDLE, TICK);
    time += TICK;
    const eye = world.player && world.player.alive ? world.player : world.soldiers.find((s) => s.alive) || world.soldiers[0];
    app.view.react(world.events, eye, time);
    if (world.player) {
      hud.react(world, world.events, eye);
      // Every few steps, as the game's own frames would, so banners and flashes age with play.
      if (i % 4 === 0) hud.update(world, eye, TICK * 4);
    }
    const stop = until && until(world, world.events);
    world.events.length = 0;
    if (stop) break;
  }
  return time;
}

function drawFrame(app, hud, time) {
  const world = app.world;
  const me = world.player;
  const eye = me && me.alive ? me : world.soldiers.find((s) => s.alive && (!me || s.team === me.team)) || world.soldiers[0];
  // A few frames so eased values (scope zoom, view kick, fading HUD flashes) settle as in play.
  for (let i = 0; i < 20; i++) {
    if (me) hud.update(world, eye, 0.05);
    app.view.render(eye, 0.05, time + i * 0.05);
  }
}

export function prepareShot(app, hud, params) {
  const seed = Number(params.get('seed') || 1);
  const team = params.get('team') || 'def';
  const role = params.get('role') || 'nurse';
  const shot = params.get('shot');
  if (shot === 'start') {
    const t = run(app, hud, Number(params.get('t') || 20));
    drawFrame(app, hud, t);
    return;
  }
  document.getElementById('title').hidden = true;
  app.world = createWorld({ seed, playerTeam: team, playerRole: role });
  app.view.rebind(app.world);
  const me = app.world.player;
  me.brain = createBrain(me);
  hud.showHud(true);
  app.mode = 'play';
  if (shot === 'play') {
    const t = run(app, hud, Number(params.get('t') || 40));
    drawFrame(app, hud, t);
  } else if (shot === 'buy') {
    const t = run(app, hud, 400, (w, events) => events.some((e) => e.type === 'roundStart' && e.round === 2));
    run(app, hud, 1.5);
    hud.toggleBuy(app.world, me, true);
    drawFrame(app, hud, t);
  } else {
    const t = run(app, hud, 2000, (w) => w.phase === 'match');
    hud.showEnd(app.world);
    drawFrame(app, hud, t);
  }
}
