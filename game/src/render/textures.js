// Every surface is painted in code on a canvas: plaza paving, the building fronts with their lit
// windows and signs, container ribs, crate planks, hedges and the painted site letters. No image
// files are loaded.
import * as THREE from 'three';

function canvasTexture(w, h, paint, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  paint(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}

/** A tiny seeded noise so the painted textures are the same every run. */
function speckle(ctx, w, h, count, colors, seed) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    ctx.globalAlpha = 0.25 + r() * 0.35;
    ctx.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3);
  }
  ctx.globalAlpha = 1;
}

export function paving() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#b9a78f';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 1800, ['#a8957c', '#cbb99f', '#9c8a73'], 7);
    ctx.strokeStyle = 'rgba(70, 58, 46, 0.45)';
    ctx.lineWidth = 2;
    for (let y = 0; y <= h; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      const off = (y / 64) % 2 ? 32 : 0;
      for (let x = off; x <= w; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 64);
        ctx.stroke();
      }
    }
  }, 30, 23);
}

/** A building front: base colour, rows of windows (some lit), and an optional sign band. */
export function facade(base, frame, glass, lit, sign, signColor, tile) {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    if (tile) {
      ctx.strokeStyle = tile;
      ctx.lineWidth = 1;
      for (let y = 0; y < h; y += 16) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }
    speckle(ctx, w, h, 900, ['rgba(0,0,0,0.3)', 'rgba(255,255,255,0.2)'], 11);
    let n = 3;
    for (let y = 96; y < h - 30; y += 96) {
      for (let x = 24; x < w - 60; x += 80) {
        n = (n * 7 + 3) % 11;
        ctx.fillStyle = frame;
        ctx.fillRect(x - 4, y - 4, 64, 68);
        ctx.fillStyle = n < 4 ? lit : glass;
        ctx.fillRect(x, y, 56, 60);
      }
    }
    if (sign) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 18, w, 58);
      ctx.fillStyle = signColor;
      ctx.font = 'bold 40px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(sign, w / 2, 60);
    }
  });
}

export function containerRibs(color) {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 12) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x, 0, 4, h);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + 5, 0, 2, h);
    }
    speckle(ctx, w, h, 500, ['#5a3a22', '#2b2b2b'], 3);
  }, 2, 1);
}

export function cratePlanks() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#b8874f';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) {
      ctx.fillStyle = 'rgba(70,40,15,0.5)';
      ctx.fillRect(0, y, w, 3);
    }
    ctx.strokeStyle = '#7a5530';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.beginPath();
    ctx.moveTo(8, 8);
    ctx.lineTo(w - 8, h - 8);
    ctx.stroke();
    speckle(ctx, w, h, 400, ['#8d6538', '#d3a46b'], 5);
  });
}

export function hedge() {
  return canvasTexture(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#3f6b39';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 1400, ['#2d5229', '#5b8c4a', '#77a35b'], 13);
  }, 3, 1);
}

export function stone() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#c9c1b3';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 900, ['#b0a797', '#ddd5c7', '#9c9384'], 17);
    ctx.strokeStyle = 'rgba(90,80,70,0.35)';
    for (let y = 0; y < h; y += 32) ctx.strokeRect(0, y, w, 32);
  });
}

/** The painted mark on the plaza where the drop zone falls. */
export function zoneDecal(letter, color) {
  const tex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 10;
    ctx.setLineDash([22, 14]);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.font = 'bold 150px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, w / 2, h / 2 + 8);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** The dusk sky behind everything. */
export function skyGradient() {
  const tex = canvasTexture(16, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1d2547');
    g.addColorStop(0.45, '#6d4a7a');
    g.addColorStop(0.7, '#e3825a');
    g.addColorStop(0.82, '#f6b56b');
    g.addColorStop(1, '#f9d79a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** A label drawn on a canvas, for floating gags and signs: returns the texture and its aspect. */
export function labelTexture(text, color, background, font = 'bold 64px Georgia, serif', pad = 18) {
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  const width = Math.ceil(probe.measureText(text).width) + pad * 2;
  const height = 96;
  const tex = canvasTexture(width, height, (ctx, w, h) => {
    if (background) {
      ctx.fillStyle = background;
      ctx.beginPath();
      ctx.roundRect(2, 2, w - 4, h - 4, 14);
      ctx.fill();
    }
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 4);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return { tex, aspect: width / height };
}
