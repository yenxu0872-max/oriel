/* Oriel's page: scrolling tells the story. Each [data-scene] learns how far
   through it you are (0 to 1) and moves to match — messages fly off to the
   cloud, facts come one at a time, the page turns from night to day. With
   "reduce motion" on, the page stays still and only the header follows. */
(() => {
  const root = document.documentElement;
  const moving = root.classList.contains('js');
  const nav = document.querySelector('.nav');
  const scenes = [...document.querySelectorAll('[data-scene]')];
  const clamp = v => Math.min(1, Math.max(0, v));
  const progress = el => {
    const r = el.getBoundingClientRect(), run = r.height - innerHeight;
    return run > 0 ? clamp(-r.top / run) : r.top <= 0 ? 1 : 0;
  };

  function steps(s, sel, p) {
    const items = s.querySelectorAll(sel);
    const at = Math.min(items.length - 1, Math.floor(p * items.length));
    items.forEach((it, i) => { it.classList.toggle('on', i === at); it.classList.toggle('past', i < at); });
    s.dataset.at = at;
    return at;
  }

  function scene(s) {
    const p = progress(s);
    switch (s.dataset.scene) {
      case 'send': {
        s.querySelectorAll('.bub').forEach((b, i) => b.classList.toggle('in', p > 0.04 + i * 0.09));
        const fly = clamp((p - 0.42) / 0.34);
        s.style.setProperty('--fly', fly.toFixed(3));
        s.classList.toggle('flying', fly > 0 && fly < 1);
        s.classList.toggle('gone', p > 0.62);
        break;
      }
      case 'facts': {
        const at = steps(s, '.fact', p);
        s.querySelectorAll('.meter i').forEach((m, i) => m.classList.toggle('on', i <= at));
        break;
      }
      case 'turn':
        s.style.setProperty('--light', clamp((p - 0.08) / 0.55).toFixed(3));
        break;
      case 'gets': {
        const at = steps(s, '.get', p);
        s.querySelectorAll('.badge').forEach((b, i) => b.classList.toggle('on', i === at));
        break;
      }
      case 'lines': {
        const words = s.querySelectorAll('.lit span');
        const lit = Math.round(clamp((p - 0.08) / 0.72) * words.length);
        words.forEach((w, i) => w.classList.toggle('on', i < lit));
        break;
      }
    }
  }

  // the header takes the colour of whatever scene is under it
  function tone() {
    const el = document.elementFromPoint(innerWidth / 2, 72);
    const sec = el && el.closest('.night, .day, .turn');
    let t = 'night';
    if (sec?.classList.contains('day')) t = 'day';
    else if (sec?.classList.contains('turn')) t = parseFloat(sec.style.getPropertyValue('--light') || (moving ? '0' : '1')) > 0.5 ? 'day' : 'night';
    if (nav.dataset.tone !== t) nav.dataset.tone = t;
  }

  let queued = false;
  function frame() {
    queued = false;
    if (moving) scenes.forEach(scene);
    tone();
  }
  const ask = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };
  addEventListener('scroll', ask, { passive: true });
  addEventListener('resize', ask);
  frame();
})();
