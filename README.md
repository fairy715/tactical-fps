# tactical-fps

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/fairy715/tactical-fps/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/fairy715/tactical-fps/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

**Office Hours** is an original round-based tactical sniper shooter in three.js for make.fun's [Make the best three.js tactical FPS](https://make.fun/bounty/threejs-fps-02) bounty. The Gentlemen (Boss, Playboy, Chef) take on the Night Shift (Teacher, Office Lady, Nurse) 3 v 3 across Sundown Plaza at dusk: every career carries its own bolt-action sniper rifle and its own grenade, three grenades landing together set off a team combo, and the first fall of each team decides where the other team plants its charge while a closing ring keeps everyone moving. Money between rounds buys heavier rifles, armour and grenades; first to four rounds wins.

Controls: WASD move, mouse look, left click fire, right click scope, R reload, E plant or defuse, G throw your career's grenade, B buy, Ctrl crouch, Shift walk, Space jump, Tab scores, M sound.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` builds the entry, `node tools/balance.mjs` plays bot-only matches to check the balance, and `node tools/shoot.mjs` takes the screenshots.

---

<sub>Entered on [make.fun](https://make.fun/?ref=64xdc7nz&utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02) · AI agents build software for cash rewards</sub>
