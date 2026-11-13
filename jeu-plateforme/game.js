// Champi Run — mini jeu de plateforme 2D original (Canvas, sans dépendance)
const cv = document.getElementById('c'), g = cv.getContext('2d');
const W = 512, H = 288, T = 16;

// Niveau : # sol, B brique, ? bloc bonus, o pièce, E ennemi, F drapeau, P départ
const MAP = [
  '                                                                                                    ',
  '                                                                                                    ',
  '                                                                                                    ',
  '                                o o o                                                               ',
  '                                                                  o o                               ',
  '                     ?B?B?     BBBBBBB                   ?       BBBB                         F     ',
  '                                                                                              #     ',
  '                                              o  o                                            #     ',
  '            ?                                BBBBBB          ##          o o o                #     ',
  '                                                            ###         BBBBBB                #     ',
  '                                     E               E     ####                   E      E    #     ',
  '  P              E          ##           E                #####                              ###    ',
  '####################   ##########   ###################  ######   ###########################  ######',
  '####################   ##########   ###################  ######   ###########################  ######',
  '####################   ##########   ###################  ######   ###########################  ######',
  '####################   ##########   ###################  ######   ###########################  ######',
  '####################   ##########   ###################  ######   ###########################  ######',
  '####################   ##########   ###################  ######   ###########################  ######',
];

const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; if (['Space','ArrowUp','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); if (e.code === 'KeyR') reset(true); });
addEventListener('keyup', e => keys[e.code] = false);
const touch = {};
document.querySelectorAll('#touch button').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { touch[k] = true; e.preventDefault(); });
  ['pointerup','pointerleave','pointercancel'].forEach(t => b.addEventListener(t, () => touch[k] = false));
});
const input = () => ({
  left: keys.ArrowLeft || keys.KeyA || touch.left,
  right: keys.ArrowRight || keys.KeyD || touch.right,
  jump: keys.Space || keys.ArrowUp || keys.KeyW || touch.jump,
});

let tiles, coins, enemies, hero, cam, score, lives, state, timer, particles, flagX, jumpHeld;

function load() {
  tiles = MAP.map(r => r.split('').map(c => '#B?'.includes(c) ? c : ' '));
  coins = []; enemies = []; particles = [];
  MAP.forEach((r, y) => [...r].forEach((c, x) => {
    if (c === 'o') coins.push({ x: x*T+4, y: y*T+4, w: 8, h: 8, t: Math.random()*6 });
    if (c === 'E') enemies.push({ x: x*T, y: y*T+2, w: 14, h: 14, vx: -0.5, vy: 0, dead: 0 });
    if (c === 'P') hero = { x: x*T, y: y*T, w: 12, h: 15, vx: 0, vy: 0, ground: false, face: 1, inv: 0 };
    if (c === 'F') flagX = x*T;
  }));
  cam = 0; state = 'play'; timer = 0;
}
function reset(full) { if (full || lives <= 0) { score = 0; lives = 3; } load(); }

const solid = (tx, ty) => tiles[ty] && tiles[ty][tx] && tiles[ty][tx] !== ' ';
function collide(o, axis) {
  const x0 = Math.floor(o.x / T), x1 = Math.floor((o.x + o.w - 0.01) / T);
  const y0 = Math.floor(o.y / T), y1 = Math.floor((o.y + o.h - 0.01) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (!solid(tx, ty)) continue;
    if (axis === 'x') { if (o.vx > 0) o.x = tx*T - o.w; else if (o.vx < 0) o.x = (tx+1)*T; o.vx = o === hero ? 0 : -o.vx; return true; }
    if (o.vy > 0) { o.y = ty*T - o.h; o.vy = 0; o.ground = true; }
    else if (o.vy < 0) { o.y = (ty+1)*T; o.vy = 0; if (o === hero) bump(tx, ty); }
    return true;
  }
  return false;
}
function bump(tx, ty) {
  if (tiles[ty][tx] === '?') {
    tiles[ty][tx] = 'B'; score += 100;
    particles.push({ x: tx*T+4, y: ty*T-10, vy: -3, life: 30, coin: true });
  }
}
const hit = (a, b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;

function hurt() {
  if (hero.inv > 0 || state !== 'play') return;
  lives--; state = lives > 0 ? 'dead' : 'over'; timer = 0; hero.vy = -5;
}

function update() {
  timer++;
  if (state === 'dead') { hero.vy += 0.3; hero.y += hero.vy; if (timer > 90) load(); return; }
  if (state === 'over' || state === 'win') { if (input().jump && timer > 60) reset(true); return; }
  const i = input();
  const acc = hero.ground ? 0.35 : 0.2;
  if (i.left) { hero.vx -= acc; hero.face = -1; }
  if (i.right) { hero.vx += acc; hero.face = 1; }
  if (!i.left && !i.right) hero.vx *= hero.ground ? 0.8 : 0.95;
  hero.vx = Math.max(-2.6, Math.min(2.6, hero.vx));
  if (i.jump && hero.ground && !jumpHeld) { hero.vy = -6.4; hero.ground = false; }
  if (!i.jump && hero.vy < -2) hero.vy = -2;           // saut variable
  jumpHeld = i.jump;
  hero.vy = Math.min(hero.vy + 0.3, 7);
  hero.x += hero.vx; collide(hero, 'x');
  hero.x = Math.max(cam, hero.x);
  hero.ground = false; hero.y += hero.vy; collide(hero, 'y');
  if (hero.inv > 0) hero.inv--;
  if (hero.y > H + 20) hurt();

  coins = coins.filter(c => { c.t += 0.15; if (hit(hero, c)) { score += 50; return false; } return true; });

  for (const e of enemies) {
    if (e.dead) { e.dead++; continue; }
    if (Math.abs(e.x - hero.x) > W) continue;              // dorment hors écran
    e.vy = Math.min(e.vy + 0.3, 7);
    e.x += e.vx; collide(e, 'x');
    e.ground = false; e.y += e.vy; collide(e, 'y');
    if (e.ground) { // demi-tour au bord
      const ahead = Math.floor((e.vx < 0 ? e.x - 1 : e.x + e.w + 1) / T), below = Math.floor((e.y + e.h + 1) / T);
      if (!solid(ahead, below)) e.vx = -e.vx;
    }
    if (hit(hero, e)) {
      if (hero.vy > 0 && hero.y + hero.h - e.y < 8) { e.dead = 1; hero.vy = -4.5; score += 200; }
      else hurt();
    }
  }
  enemies = enemies.filter(e => e.dead < 30 && e.y < H + 40);
  particles = particles.filter(p => { p.y += p.vy; p.vy += 0.2; return --p.life > 0; });

  if (hero.x >= flagX - 4) { state = 'win'; timer = 0; score += 1000; }
  cam = Math.max(cam, Math.min(hero.x - W * 0.4, MAP[0].length * T - W));
}

// ---------- rendu ----------
function rect(c, x, y, w, h) { g.fillStyle = c; g.fillRect(Math.round(x - cam), Math.round(y), w, h); }
function drawTile(t, x, y) {
  if (t === '#') { rect('#8b4a1c', x, y, T, T); rect('#c0703a', x+1, y+1, T-2, 3); if (y === 12*T) rect('#3fae3f', x, y, T, 4); }
  if (t === 'B') { rect('#b5541c', x, y, T, T); rect('#7a3210', x, y+7, T, 1); rect('#7a3210', x+7, y, 1, 7); rect('#7a3210', x+3, y+8, 1, 8); rect('#7a3210', x+11, y+8, 1, 8); }
  if (t === '?') { rect('#f2b233', x, y, T, T); rect('#9c5d00', x, y+T-1, T, 1); g.fillStyle = '#fff'; g.font = 'bold 11px monospace'; g.fillText('★', x - cam + 3, y + 12); }
}
function drawHero() {
  const h = hero; if (h.inv % 6 > 2) return;
  const x = h.x, y = h.y, f = h.face;
  rect('#e8e0c8', x+1, y+5, 10, 7);                            // corps
  rect('#2d6cdf', x+1, y+10, 10, 3);                            // salopette
  rect('#d83c3c', x-1, y, 14, 6); rect('#fff', x+2, y+1, 3, 3); rect('#fff', x+8, y+2, 2, 2); // chapeau-champignon
  rect('#222', x + (f > 0 ? 7 : 3), y+7, 2, 2);                // œil
  const step = h.ground && Math.abs(h.vx) > 0.3 ? (Math.floor(timer / 5) % 2) * 2 : 0;
  rect('#5a3a1a', x+1, y+13-step/2, 4, 2); rect('#5a3a1a', x+7, y+13-(2-step)/2, 4, 2);
}
function drawEnemy(e) {
  if (e.dead) { rect('#6a3d8f', e.x, e.y + 10, e.w, 4); return; }
  const w = Math.floor(timer / 8) % 2;
  rect('#6a3d8f', e.x, e.y+2, e.w, 10); rect('#8e5cb8', e.x+2, e.y, e.w-4, 4);
  rect('#fff', e.x+3, e.y+4, 3, 3); rect('#fff', e.x+8, e.y+4, 3, 3); rect('#000', e.x+4, e.y+5, 1, 2); rect('#000', e.x+9, e.y+5, 1, 2);
  rect('#2a1a3a', e.x + (w ? 0 : 2), e.y+12, 4, 2); rect('#2a1a3a', e.x + (w ? 10 : 8), e.y+12, 4, 2);
}
function draw() {
  g.fillStyle = '#6bb6ff'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 12; i++) {                               // décor parallaxe
    const cx = ((i * 180 - cam * 0.3) % 2160 + 2160) % 2160 - 100;
    g.fillStyle = '#fff'; g.fillRect(cx, 30 + (i % 3) * 18, 40, 10); g.fillRect(cx + 8, 24 + (i % 3) * 18, 22, 8);
    const hx = ((i * 220 - cam * 0.6) % 2640 + 2640) % 2640 - 120;
    g.fillStyle = '#4c9e4c'; g.beginPath(); g.ellipse(hx, 192, 60, 26, 0, Math.PI, 0); g.fill();
  }
  const x0 = Math.floor(cam / T), x1 = x0 + W / T + 1;
  for (let y = 0; y < tiles.length; y++) for (let x = x0; x <= x1; x++) if (solid(x, y)) drawTile(tiles[y][x], x*T, y*T);
  rect('#ddd', flagX + 7, 2*T, 2, 4*T); rect('#3fae3f', flagX + 9, 2*T, 12, 9); rect('#f2b233', flagX + 6, 2*T - 3, 4, 4);
  for (const c of coins) { const s = Math.abs(Math.sin(c.t)) * 8; rect('#ffd23f', c.x + 4 - s/2, c.y, Math.max(2, s), 8); }
  for (const p of particles) rect('#ffd23f', p.x, p.y, 8, 8);
  enemies.forEach(drawEnemy);
  drawHero();
  g.fillStyle = '#fff'; g.font = 'bold 12px monospace';
  g.fillText(`SCORE ${String(score).padStart(6, '0')}`, 10, 18);
  g.fillText(`♥ x${lives}`, W - 60, 18);
  const msg = { win: ['BRAVO !', 'Saute pour rejouer'], over: ['GAME OVER', 'Saute pour rejouer'] }[state];
  if (msg) {
    g.fillStyle = '#0008'; g.fillRect(0, 0, W, H); g.textAlign = 'center';
    g.fillStyle = '#fff'; g.font = 'bold 28px monospace'; g.fillText(msg[0], W/2, H/2 - 8);
    g.font = '12px monospace'; g.fillText(`${msg[1]} · score ${score}`, W/2, H/2 + 16); g.textAlign = 'left';
  }
}

reset(true);
let last = performance.now(), accu = 0;
(function loop(now) {
  accu += Math.min(100, now - last); last = now;
  while (accu >= 1000/60) { update(); accu -= 1000/60; }
  draw(); requestAnimationFrame(loop);
})(last);
window.__game = { get state() { return state; }, get score() { return score; }, get hero() { return hero; }, get coins() { return coins.length; } };
