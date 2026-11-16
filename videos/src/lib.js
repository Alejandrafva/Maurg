// Motor mínimo de animación determinista: render(t) dibuja el cuadro del segundo t.
const W = 1080, H = 1920;
const C = {
  brown: '#381D14', brown2: '#4B271A', cocoa: '#6B3A2A',
  pink: '#C96B7A', rose: '#E3A3AE', blush: '#F4D9DA', cream: '#FBF2EE',
};
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const mix = (a, b, k) => a + (b - a) * k;
const ease = {
  lin: x => x,
  out: x => 1 - Math.pow(1 - x, 3),
  in: x => x * x * x,
  inOut: x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  expo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  back: x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  elastic: x => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * (2 * Math.PI / 3)) + 1),
};
// progreso de 0 a 1 entre t0 y t1
const p = (t, t0, t1, e = ease.out) => e(clamp((t - t0) / (t1 - t0)));
// entra y sale: 0→1 en [a,a+d], 1→0 en [b-d,b]
const io = (t, a, b, d = .35, e = ease.out) => Math.min(p(t, a, a + d, e), 1 - p(t, b - d, b, ease.in));

function mk(tag, cls, html, parent) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (html != null) el.innerHTML = html;
  (parent || document.getElementById('stage')).appendChild(el);
  return el;
}
// Coloca un elemento centrado en (x,y)
function set(el, o) {
  const { x = W / 2, y = H / 2, s = 1, sx = 1, sy = 1, r = 0, o: op = 1, blur = 0, ry = 0 } = o;
  el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) rotate(${r}deg) rotateY(${ry}deg) scale(${s * sx},${s * sy})`;
  el.style.opacity = op;
  el.style.filter = blur > .05 ? `blur(${blur}px)` : '';
  el.style.visibility = op <= .001 ? 'hidden' : 'visible';
}
// Cartera recortada con sombra suave
function bag(name, h, parent) {
  const w = mk('div', 'bag', `<div class="shadow"></div><img src="../assets/bags/${name}.png">`, parent);
  w.style.height = h + 'px';
  return w;
}
// Texto partido en letras / palabras
function split(el, text, mode = 'char') {
  el.innerHTML = '';
  const parts = mode === 'char' ? [...text] : text.split(' ');
  return parts.map((ch, i) => {
    const s = document.createElement('span');
    s.className = 'ch';
    s.textContent = ch === ' ' ? ' ' : ch;
    el.appendChild(s);
    if (mode === 'word' && i < parts.length - 1) el.appendChild(document.createTextNode(' '));
    return s;
  });
}
function letters(spans, t, t0, stagger = .05, dur = .5, dy = 60) {
  spans.forEach((s, i) => {
    const k = p(t, t0 + i * stagger, t0 + i * stagger + dur, ease.out);
    s.style.transform = `translateY(${(1 - k) * dy}px)`;
    s.style.opacity = k;
    s.style.filter = k < .99 ? `blur(${(1 - k) * 8}px)` : '';
  });
}
// Iconos (trazos estilo línea)
const ICON = {
  pin: '<path d="M12 22s-7-6.5-7-12a7 7 0 1 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="10" r="2.6"/>',
  truck: '<path d="M2 6h11v10H2z"/><path d="M13 9h4.5l3.5 3.6V16h-8"/><circle cx="6" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8.5 15l2.2 2.2L15.5 13"/>',
  moto: '<circle cx="5.5" cy="17" r="3"/><circle cx="18.5" cy="17" r="3"/><path d="M8.5 17h6l3-6h-4l-2 3H7.5"/><path d="M14 7h2.5l2 4"/>',
  globe: '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c2.8 3 2.8 16 0 19M12 2.5c-2.8 3-2.8 16 0 19"/>',
  insta: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".6" fill="currentColor"/>',
  whats: '<path d="M4 20l1.2-3.8A8.5 8.5 0 1 1 8 19.1z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .9c-1-.4-2.4-1.8-2.8-2.8l.9-1-1-2z"/>',
  check: '<path d="M4.5 12.5l4.5 4.5L19.5 6.5"/>',
  gift: '<rect x="3" y="9" width="18" height="12" rx="1"/><path d="M2 9h20M12 9v12"/><path d="M12 9c-1-4-6-5-6-2s6 2 6 2zM12 9c1-4 6-5 6-2s-6 2-6 2z"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M16 15h2"/><path d="M6 6l9-3 1 3"/>',
  bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  phone: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  spark: '<path d="M12 2c.6 5 2.4 7.4 10 10-7.6 2.6-9.4 5-10 10-.6-5-2.4-7.4-10-10 7.6-2.6 9.4-5 10-10z" fill="currentColor" stroke="none"/>',
  heart: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',
  box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  tag: '<path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
};
function icon(name, size, color, sw = 1.6) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" style="color:${color}">${ICON[name]}</svg>`;
}
// Logo MAURG. ©
function logoHTML(color, size) {
  return `<div class="logo" style="color:${color};font-size:${size}px">MAUR<i>G</i><b>.</b><sup>©</sup></div>`;
}

// Escenas con transición de entrada
const SCENES = [];
function scene(start, bg, enter = 'none', tdur = .6, origin = [W / 2, H / 2]) {
  const el = mk('div', 'scene');
  el.style.background = bg;
  const sc = { el, start, enter, tdur, origin, parts: [] };
  SCENES.push(sc);
  return sc;
}
function renderScenes(t, D) {
  SCENES.forEach((s, i) => {
    const next = SCENES[i + 1];
    const end = next ? next.start + next.tdur : D + 1;
    const vis = t >= s.start && t < end;
    s.el.style.display = vis ? 'block' : 'none';
    if (!vis) return;
    const k = p(t, s.start, s.start + s.tdur, ease.inOut);
    const [cx, cy] = s.origin;
    let clip = '';
    if (s.enter === 'circle' && k < 1) clip = `circle(${k * 2300}px at ${cx}px ${cy}px)`;
    if (s.enter === 'up' && k < 1) clip = `inset(${(1 - k) * 100}% 0 0 0)`;
    if (s.enter === 'down' && k < 1) clip = `inset(0 0 ${(1 - k) * 100}% 0)`;
    if (s.enter === 'left' && k < 1) clip = `inset(0 0 0 ${(1 - k) * 100}%)`;
    if (s.enter === 'blinds' && k < 1) clip = `polygon(${[0, 1, 2, 3, 4, 5].map(j => { const x0 = j * W / 6, w = k * W / 6; return `${x0}px 0,${x0 + w}px 0,${x0 + w}px ${H}px,${x0}px ${H}px,${x0}px 0`; }).join(',')})`;
    s.el.style.clipPath = clip;
    s.el.style.zIndex = i;
    s.draw && s.draw(t - s.start, t);
  });
}
// Brillos flotantes decorativos
function sparkles(parent, n, color, seed = 1) {
  let r = seed;
  const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: n }, () => {
    const el = mk('div', 'abs', icon('spark', 20 + rnd() * 34, color), parent);
    return { el, x: rnd() * W, y: rnd() * H, ph: rnd() * 6.28, sp: .6 + rnd() * 1.2 };
  });
}
function drawSparkles(list, lt, on = 1) {
  list.forEach(s => {
    const tw = (Math.sin(lt * 2.4 * s.sp + s.ph) + 1) / 2;
    set(s.el, { x: s.x, y: s.y - lt * 18 * s.sp, s: .5 + tw * .7, r: lt * 40 * s.sp, o: on * (.25 + tw * .75) });
  });
}
