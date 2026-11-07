// Split-flap display primitives: Flap (one character), Row (a set of cells).

const CHARS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:-./'+";
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const HALF_MS = 38; // each half of a flip

function normalise(text, len) {
  return String(text ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9:\-./'+ ]/g, ' ')
    .padEnd(len, ' ').slice(0, len);
}

function el(cls, ch) {
  const d = document.createElement('div');
  d.className = cls;
  if (ch !== undefined) d.appendChild(document.createElement('span')).textContent = ch;
  return d;
}

class Flap {
  constructor(onFlip) {
    this.cur = ' '; this.target = ' '; this.running = false; this.onFlip = onFlip;
    this.root = el('flap');
    this.top = el('half top', ' ');          // shows NEW upper half during a flip
    this.bottom = el('half bottom', ' ');    // shows OLD lower half until the leaf lands
    this.leafTop = el('leaf top', ' ');      // OLD upper half, folds down
    this.leafBottom = el('leaf bottom', ' ');// NEW lower half, unfolds
    this.root.append(this.top, this.bottom, this.leafTop, this.leafBottom, document.createElement('i'));
  }

  static paint(node, ch) { node.firstChild.textContent = ch; }

  /** Flip (via every intervening character, like the real thing) to `ch`. */
  set(ch, delay = 0) {
    this.target = ch;
    if (this.running || ch === this.cur) return;
    if (REDUCED || document.hidden) { this._show(ch); return; }
    this.running = true;
    setTimeout(() => this._step(), delay);
  }

  _show(ch) {
    this.cur = ch;
    for (const n of [this.top, this.bottom, this.leafTop, this.leafBottom]) Flap.paint(n, ch);
  }

  async _step() {
    if (this.cur === this.target || document.hidden) {
      if (this.cur !== this.target) this._show(this.target);
      this.running = false;
      return;
    }
    const idx = CHARS.indexOf(this.cur);
    const next = CHARS[(idx + 1) % CHARS.length];
    await this._flip(this.cur, next);
    this.cur = next;
    this._step();
  }

  async _flip(from, to) {
    Flap.paint(this.top, to);
    Flap.paint(this.leafTop, from);
    Flap.paint(this.leafBottom, to);
    this.leafTop.style.display = this.leafBottom.style.display = 'block';
    if (this.onFlip) this.onFlip();
    await this.leafTop.animate(
      [{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-90deg)' }],
      { duration: HALF_MS, easing: 'ease-in', fill: 'forwards' }).finished;
    await this.leafBottom.animate(
      [{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(0deg)' }],
      { duration: HALF_MS, easing: 'ease-out', fill: 'forwards' }).finished;
    Flap.paint(this.bottom, to);
    this.leafTop.style.display = this.leafBottom.style.display = 'none';
    for (const l of [this.leafTop, this.leafBottom]) l.getAnimations().forEach((a) => a.cancel());
  }
}

class Row {
  /** @param {{key:string,len:number,cls:string}[]} columns */
  constructor(columns, onFlip) {
    this.columns = columns;
    this.root = el('row');
    this.root.setAttribute('role', 'row');
    this.cells = columns.map((c) => {
      const cell = el('cell ' + c.cls);
      cell.style.setProperty('--n', c.len);
      cell.setAttribute('role', 'cell');
      const flaps = Array.from({ length: c.len }, () => new Flap(onFlip));
      cell.append(...flaps.map((f) => f.root));
      this.root.appendChild(cell);
      return flaps;
    });
  }

  /** values: {key: text}. Cells cascade left-to-right, characters stagger within a cell. */
  set(values, rowDelay = 0, state = '') {
    this.root.dataset.s = state;
    let order = 0;
    this.columns.forEach((c, ci) => {
      const text = normalise(values[c.key], c.len);
      this.root.children[ci].setAttribute('aria-label', text.trim());
      this.cells[ci].forEach((flap, i) => flap.set(text[i], rowDelay + (order++) * 12));
    });
  }
}

export { Row, normalise };
