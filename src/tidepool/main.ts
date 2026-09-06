import './style.css';
import { WIDTH, HEIGHT, DT, LINEAGES, clamp } from './model';
import type { View, Tool, Lens, Preset, Pool } from './model';
import { createPool, colonies } from './world';
import { PoolRenderer } from './render';
import { PoolAudio } from './audio';
import { History, readExperiment } from './history';

const el = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing interface element: ${id}`);
  return element as T;
};
const click = (id: string, action: () => void) => el(id).addEventListener('click', action);
const fmt = (step: number) => `${String(Math.floor(step * DT / 60)).padStart(2, '0')}:${String(Math.floor(step * DT % 60)).padStart(2, '0')}`;

function init(): void {
  const params = new URLSearchParams(location.search), rawSeed = params.get('seed');
  const seed = rawSeed !== null && /^\d+$/.test(rawSeed) ? Number(rawSeed) >>> 0 : 2718;
  const preset = (['reef', 'channel', 'spores'].includes(params.get('habitat') ?? '') ? params.get('habitat') : 'reef') as Preset;
  let history = new History(createPool(seed, preset));
  const canvas = el<HTMLCanvasElement>('pool'), renderer = new PoolRenderer(canvas), audio = new PoolAudio();
  const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const view: View = { x: innerWidth < 700 ? 690 : 780, y: 450, zoom: innerWidth < 700 ? 3 : 1.15, selected: null, lens: 'life', tool: 'observe', pointer: null, reduced: reducedQuery.matches };
  let paused = reducedQuery.matches, speed = 1, follow = false, comparing = false, accumulator = 0, last = performance.now(), lastUi = 0;
  let groupKey = '', selectedKey = '', messageUntil = 0, lastEventStep = -1, lastEventText = '', exploring = false;
  let raf = 0, sumRender = 0, renderSamples = 0, maxRender = 0;
  const timeline = el<HTMLInputElement>('timeline'), habitat = el<HTMLSelectElement>('habitat'), chooser = el<HTMLSelectElement>('specimen-select');
  habitat.value = preset;
  const showing = (): Pool => comparing && history.reference ? history.reference : history.pool;
  const say = (message: string, duration = 6000) => { el('observation').textContent = message; messageUntil = performance.now() + duration; };
  const press = (id: string, on: boolean) => el(id).setAttribute('aria-pressed', String(on));

  function playback(): void {
    el('play').setAttribute('aria-label', paused ? 'Play simulation' : 'Pause simulation');
    el('play-label').textContent = paused ? 'Play' : 'Pause';
    el('play-icon').querySelector('path')!.setAttribute('d', paused ? 'M7 4 19 12 7 20Z' : 'M8 5v14M16 5v14');
    accumulator = 0;
  }
  function select(id: number | null): void { view.selected = id; follow = false; selectedKey = ''; updateUi(); }
  function setTool(tool: Tool): void {
    view.tool = tool;
    document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === tool)));
    say(({ observe: 'Pick a little creature. Drag the water to wander.', feed: 'Click the water to leave a little nourishment.', current: 'Click the water to send a gentle swirl.', cut: 'Click across a body to separate its connections.' })[tool]);
  }
  function zoom(factor: number): void { view.zoom = clamp(view.zoom * factor, 0.65, 5); }
  function reset(nextSeed: number, nextPreset: Preset): void {
    history = new History(createPool(nextSeed, nextPreset));
    comparing = false; follow = false; view.selected = null;
    view.x = innerWidth < 700 ? 690 : 780; view.y = 450; view.zoom = innerWidth < 700 ? 3 : 1.15;
    groupKey = ''; lastEventStep = -1; accumulator = 0; habitat.value = nextPreset;
    const url = new URL(location.href); url.searchParams.set('seed', String(nextSeed)); url.searchParams.set('habitat', nextPreset);
    window.history.replaceState(null, '', url);
    say(nextPreset === 'spores' ? 'Little beginnings. Let’s see who finds each other.' : 'A fresh little world. Take your time.');
    updateUi();
  }
  function updateUi(): void {
    const pool = showing(), groups = colonies(pool), selected = groups.find(g => g.cells.some(c => c.id === view.selected));
    el('elapsed').textContent = fmt(pool.step);
    el('elapsed').setAttribute('datetime', `PT${Math.floor(pool.step * DT)}S`);
    timeline.min = String(history.start); timeline.max = String(Math.max(history.end, history.start + 1)); timeline.value = String(history.pool.step);
    timeline.setAttribute('aria-valuetext', `${fmt(history.pool.step)} of ${fmt(history.end)}`);
    el('population').textContent = `${pool.cells.length} little cells · ${groups.filter(g => g.cells.length >= 4).length} bodies`;
    el('seed-button').textContent = String(pool.seed);
    el('comparison').hidden = !history.branched;
    press('show-original', comparing); press('show-branch', !comparing);
    el('habitat-caption').textContent = comparing ? 'The way it was.' : history.branched ? 'A different little possibility.' : 'A little world, in no hurry.';
    const choices = groups.filter(g => g.cells.length >= 4).slice(0, 12);
    const key = choices.map(g => `${g.id}:${g.cells.length}`).join(',');
    if (groupKey !== key && document.activeElement !== chooser) {
      const current = chooser.value;
      chooser.replaceChildren(new Option('Meet a creature', ''));
      choices.forEach(g => chooser.add(new Option(`${LINEAGES[g.lineage].name} · ${g.cells.length} cells`, String(g.cells[0].id))));
      chooser.value = current; groupKey = key;
    }
    el('specimen').hidden = !selected;
    if (selected) {
      const family = LINEAGES[selected.lineage];
      el('specimen').style.setProperty('--specimen-color', family.color);
      el('specimen-name').textContent = family.name;
      el('specimen-kind').textContent = `${selected.cells.length < 4 ? 'A little fragment' : family.kind} · ${selected.id}`;
      el('cell-count').textContent = String(selected.cells.length);
      el('energy-reading').textContent = `${Math.round(selected.energy * 100)}%`;
      el('coherence-reading').textContent = `${Math.round(selected.coherence * 100)}%`;
      const phrase = selected.energy < 0.35 ? 'A little nourishment would help.' : selected.coherence > 0.8 ? 'Finding a rhythm together.' : selected.cells.length < 4 ? 'Small, and still finding a way.' : 'Each cell moving to its own little beat.';
      if (selectedKey !== phrase) { el('specimen-observation').textContent = phrase; selectedKey = phrase; }
      press('follow', follow); el('follow').textContent = follow ? 'Following · stop' : 'Follow this friend';
    } else if (view.selected !== null) { view.selected = null; follow = false; say('That cell has returned to the water.'); }
    const recent = pool.events[pool.events.length - 1];
    if (recent && (recent.step !== lastEventStep || recent.text !== lastEventText) && performance.now() > messageUntil) {
      el('observation').textContent = recent.text; lastEventStep = recent.step; lastEventText = recent.text;
    }
    if (pool.cells.length === 0 && performance.now() > messageUntil) el('observation').textContent = 'The pond is quiet. A new world is only a click away.';
  }

  click('play', () => { paused = !paused; playback(); });
  el<HTMLSelectElement>('speed').addEventListener('change', e => { speed = Number((e.target as HTMLSelectElement).value); });
  click('sound', () => {
    if (!audio.muted) { audio.setMuted(true); press('sound', false); el('sound').querySelector('span')!.textContent = 'Listen'; return; }
    void audio.enable().then(() => { press('sound', true); el('sound').querySelector('span')!.textContent = 'Sound on'; })
      .catch(() => say('Sound couldn’t start. Tap Listen to try again.'));
  });
  el<HTMLInputElement>('volume').addEventListener('input', e => audio.setVolume(Number((e.target as HTMLInputElement).value) / 100));
  click('explore', () => {
    exploring = !exploring; el('experience').classList.toggle('exploring', exploring); press('explore', exploring);
    el('explore').textContent = exploring ? 'Just unwind' : 'Explore';
    if (!exploring) { setTool('observe'); view.lens = 'life'; el<HTMLSelectElement>('lens').value = 'life'; }
  });
  click('guide-open', () => el<HTMLDialogElement>('guide').showModal());
  click('guide-close', () => el<HTMLDialogElement>('guide').close());
  click('deselect', () => select(null));
  click('follow', () => {
    follow = !follow && view.selected !== null;
    if (follow) view.zoom = Math.max(view.zoom, innerWidth < 700 ? 3.2 : 2.4);
    updateUi();
  });
  click('zoom-in', () => zoom(1.25)); click('zoom-out', () => zoom(0.8));
  click('fit', () => { follow = false; view.x = WIDTH / 2; view.y = HEIGHT / 2; view.zoom = 1; updateUi(); });
  chooser.addEventListener('change', () => select(chooser.value ? Number(chooser.value) : null));
  document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool as Tool)));
  el<HTMLSelectElement>('lens').addEventListener('change', e => { view.lens = (e.target as HTMLSelectElement).value as Lens; });
  timeline.addEventListener('input', () => { paused = true; playback(); history.seek(Number(timeline.value)); lastEventStep = -1; updateUi(); });
  click('branch', () => { history.fork(); comparing = false; say('A new possibility. Change something, then compare.'); updateUi(); });
  click('show-original', () => { comparing = true; updateUi(); });
  click('show-branch', () => { comparing = false; updateUi(); });
  click('new-world', () => reset(crypto.getRandomValues(new Uint32Array(1))[0], habitat.value as Preset));
  habitat.addEventListener('change', () => reset(history.pool.seed, habitat.value as Preset));
  click('seed-button', () => { el<HTMLInputElement>('seed-input').value = String(history.pool.seed); el<HTMLDialogElement>('seed-dialog').showModal(); });
  click('seed-cancel', () => el<HTMLDialogElement>('seed-dialog').close());
  el('seed-form').addEventListener('submit', e => {
    e.preventDefault(); const value = Number(el<HTMLInputElement>('seed-input').value);
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) return;
    reset(value, habitat.value as Preset); el<HTMLDialogElement>('seed-dialog').close();
  });
  click('save', () => {
    const blob = new Blob([history.export()], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `motes-${history.pool.seed}-${history.pool.step}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); say('This little moment is yours to keep.');
  });
  click('load', () => el<HTMLInputElement>('file').click());
  el<HTMLInputElement>('file').addEventListener('change', async e => {
    const input = e.target as HTMLInputElement, file = input.files?.[0]; if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Choose a Motes experiment under 2 MB.');
      const imported = readExperiment(await file.text());
      history = imported; comparing = false; paused = true; follow = false; view.selected = null; groupKey = ''; lastEventStep = -1;
      habitat.value = history.pool.preset; playback(); updateUi(); say('Welcome back to this little moment. Press play when you’re ready.');
    } catch (error) { say(error instanceof Error ? error.message : 'This experiment could not be opened.', 12000); }
    input.value = '';
  });

  const pointers = new Map<number, { x: number; y: number }>();
  let gesture: { x: number; y: number; startX: number; startY: number; moved: boolean } | null = null, pinch = 0, suppressTap = false;
  const local = (e: PointerEvent | WheelEvent) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', e => {
    if (pointers.size === 0) suppressTap = false;
    const p = local(e); pointers.set(e.pointerId, p); canvas.setPointerCapture(e.pointerId);
    gesture = { ...p, startX: p.x, startY: p.y, moved: false };
    if (pointers.size >= 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); gesture.moved = true; suppressTap = true; }
  });
  canvas.addEventListener('pointermove', e => {
    const p = local(e); view.pointer = renderer.toWorld(p.x, p.y, view);
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, p);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0) zoom(distance / pinch); pinch = distance; if (gesture) gesture.moved = true; return;
    }
    if (gesture && (view.tool === 'observe' || e.buttons === 4)) {
      if (Math.hypot(p.x - gesture.startX, p.y - gesture.startY) > 5) gesture.moved = true;
      if (gesture.moved) {
        follow = false; view.x = clamp(view.x - (p.x - gesture.x) / renderer.scale, 0, WIDTH);
        view.y = clamp(view.y - (p.y - gesture.y) / renderer.scale, 0, HEIGHT);
      }
      gesture.x = p.x; gesture.y = p.y;
    }
  });
  const actAt = (point: { x: number; y: number }) => {
    if (view.tool === 'observe') return;
    if (comparing) { say('Switch to Your branch to make a change.'); return; }
    history.command({ type: view.tool, x: point.x, y: point.y });
    const recent = history.pool.events[history.pool.events.length - 1]; if (recent) say(recent.text);
    updateUi();
  };
  canvas.addEventListener('pointerup', e => {
    const p = local(e), point = renderer.toWorld(p.x, p.y, view), moved = gesture?.moved;
    pointers.delete(e.pointerId); gesture = null; pinch = 0;
    if (moved || pointers.size > 0 || suppressTap) return;
    if (view.tool === 'observe') {
      let closest: number | null = null, distance = 35 / Math.max(0.6, renderer.scale);
      for (const c of showing().cells) { const d = Math.hypot(c.x - point.x, c.y - point.y); if (d < distance) { closest = c.id; distance = d; } }
      select(closest);
    } else actAt(point);
  });
  canvas.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); gesture = null; pinch = 0; suppressTap = true; });
  canvas.addEventListener('pointerleave', () => { view.pointer = null; });
  canvas.addEventListener('wheel', e => {
    e.preventDefault(); const p = local(e), before = renderer.toWorld(p.x, p.y, view);
    zoom(Math.exp(-e.deltaY * 0.001)); const after = renderer.toWorld(p.x, p.y, view);
    view.x = clamp(view.x + before.x - after.x, 0, WIDTH); view.y = clamp(view.y + before.y - after.y, 0, HEIGHT); follow = false;
  }, { passive: false });
  document.addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]') || (e.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName))) return;
    if (e.code === 'Space') { e.preventDefault(); paused = !paused; playback(); }
    else if (e.key === '+' || e.key === '=') zoom(1.2);
    else if (e.key === '-') zoom(1 / 1.2);
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault(); follow = false;
      view.x = clamp(view.x + (e.key === 'ArrowRight' ? 40 : e.key === 'ArrowLeft' ? -40 : 0) / view.zoom, 0, WIDTH);
      view.y = clamp(view.y + (e.key === 'ArrowDown' ? 40 : e.key === 'ArrowUp' ? -40 : 0) / view.zoom, 0, HEIGHT);
      view.pointer = { x: view.x, y: view.y };
    }
    else if (e.key === 'Enter') { e.preventDefault(); actAt({ x: view.x, y: view.y }); }
    else if (e.key.toLowerCase() === 'f') el('follow').click();
    else if (e.key === 'Escape') { select(null); setTool('observe'); }
    else if (['1', '2', '3', '4'].includes(e.key)) { if (!exploring) el('explore').click(); setTool((['observe', 'feed', 'current', 'cut'] as Tool[])[Number(e.key) - 1]); view.pointer = { x: view.x, y: view.y }; }
  });
  reducedQuery.addEventListener('change', e => {
    // Chromium temporarily clears emulated preferences while a page is cached.
    // Ignore those hidden-page transitions; preserve the viewer's chosen transport state.
    if (document.hidden || view.reduced === e.matches) return;
    view.reduced = e.matches;
    if (e.matches) { paused = true; follow = false; playback(); }
  });
  const resize = new ResizeObserver(() => renderer.resize()); resize.observe(canvas); renderer.resize();
  document.addEventListener('visibilitychange', () => { last = performance.now(); accumulator = 0; audio.update(showing(), view.selected, document.hidden || paused); });
  playback(); updateUi();

  function frame(now: number): void {
    const delta = Math.min((now - last) / 1000, 0.1); last = now;
    if (!document.hidden) {
      if (!paused) { accumulator += delta * speed; for (let i = 0; accumulator >= DT && i < 12; i++) { history.advance(); accumulator -= DT; } }
      const pool = showing();
      if (follow && view.selected !== null && !view.reduced) {
        const group = colonies(pool).find(g => g.cells.some(c => c.id === view.selected));
        if (group) { const ease = 1 - Math.exp(-delta * 1.6); view.x += (group.x - view.x) * ease; view.y += (group.y + 20 - view.y) * ease; }
      }
      const renderStart = performance.now(); renderer.draw(pool, view);
      const renderMs = performance.now() - renderStart; sumRender += renderMs; renderSamples++; maxRender = Math.max(maxRender, renderMs);
      if (now - lastUi > 180) { updateUi(); audio.update(pool, view.selected, paused); lastUi = now; }
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  if (params.has('debug')) Object.defineProperty(window, '__tidepool', { configurable: true, value: {
    get pool() { return history.pool; }, get reference() { return history.reference; }, get paused() { return paused; },
    get view() { return { ...view }; }, get rendering() { return { meanMs: sumRender / Math.max(1, renderSamples), maxMs: maxRender, samples: renderSamples }; },
    advance(steps: number) { for (let i = 0; i < Math.min(6000, steps); i++) history.advance(); updateUi(); },
    export: () => history.export(),
  } });
  window.addEventListener('pagehide', e => {
    cancelAnimationFrame(raf); audio.update(showing(), view.selected, true);
    if (!e.persisted) { resize.disconnect(); audio.dispose(); }
  });
  window.addEventListener('pageshow', e => {
    if (!e.persisted) return;
    last = performance.now(); accumulator = 0; renderer.resize();
    raf = requestAnimationFrame(frame);
  });
}

try { init(); } catch (error) {
  const failure = el('failure'); failure.hidden = false;
  failure.textContent = `The pond couldn’t open. Try reloading this page. ${error instanceof Error ? error.message : ''}`;
  console.error(error);
}
