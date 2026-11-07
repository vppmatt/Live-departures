// Split-flap display primitives: Flap (one character), Row (a set of cells).
//
// A flip is ONE continuous animation of a two-faced leaf hinged on the centre seam:
// its front face (old top half) swings down through 180deg and its back face (new bottom
// half) lands on the lower half. Leaves are created lazily and travel is capped, so even
// a full-board update stays light enough for a phone.

const CHARS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:-./'+";
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FLIP_MS = 110;     // one full flip; ~6 frames at 60Hz
const MAX_FLIPS = 6;     // never cycle more than this many cards per update
const EASE = 'cubic-bezier(.45, 0, .85, .55)'; // slow start, gravity-like finish

export function normalise(text, len) {
  return String(text ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9:\-./'+ ]/g, ' ')
    .padEnd(len, ' ').slice(0, len);
}

function face(cls) {
  const d = document.createElement('div');
  d.className = cls;
  const s = d.appendChild(document.createElement('span'));
  s.appendChild(document.createTextNode(' '));
  return d;
}
const paint = (node, ch) => { node.firstChild.firstChild.nodeValue = ch; };

class Flap {
  constructor(onFlip) {
    this.cur = ' '; this.target = ' '; this.running = false; this.onFlip = onFlip;
    this.leaf = null;
    this.root = document.createElement('div');
    this.root.className = 'flap';
    this.top = face('half top');
    this.bottom = face('half bottom');
    this.root.append(this.top, this.bottom);
  }

  _ensureLeaf() {
    if (this.leaf) return;
    this.leaf = document.createElement('div');
    this.leaf.className = 'leaf';
    this.front = face('face front top');   // old upper half
    this.back = face('face back bottom');  // new lower half (pre-rotated 180deg)
    this.leaf.append(this.front, this.back);
    this.root.appendChild(this.leaf);
  }

  /** Flip to `ch`, passing through the characters in between (capped at MAX_FLIPS cards). */
  set(ch, delay = 0) {
    this.target = ch;
    if (this.running || ch === this.cur) return;
    if (REDUCED || document.hidden) { this._show(ch); return; }
    this.running = true;
    // Distance round the drum; if long, the first card jumps ahead so we flip <= MAX_FLIPS.
    const n = CHARS.length;
    const dist = (CHARS.indexOf(ch) - CHARS.indexOf(this.cur) + n) % n;
    this.skip = Math.max(0, dist - MAX_FLIPS);
    setTimeout(() => this._step(), delay);
  }

  _show(ch) {
    this.cur = ch;
    paint(this.top, ch); paint(this.bottom, ch);
  }

  async _step() {
    while (this.cur !== this.target) {
      if (document.hidden) { this._show(this.target); break; }
      const n = CHARS.length;
      const next = CHARS[(CHARS.indexOf(this.cur) + 1 + this.skip) % n];
      this.skip = 0;
      await this._flip(this.cur, next);
      this.cur = next;
    }
    this.running = false;
  }

  async _flip(from, to) {
    this._ensureLeaf();
    paint(this.top, to);          // revealed as the leaf lifts
    paint(this.front, from);
    paint(this.back, to);
    this.leaf.style.visibility = 'visible';
    if (this.onFlip) this.onFlip();
    const anim = this.leaf.animate(
      [{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-180deg)' }],
      { duration: FLIP_MS, easing: EASE, fill: 'forwards' });
    await anim.finished;
    paint(this.bottom, to);       // the leaf now sits exactly on top of this; swap underneath
    this.leaf.style.visibility = 'hidden';
    anim.cancel();
  }
}

export class Row {
  /** @param {{key:string,len:number,cls:string}[]} columns */
  constructor(columns, onFlip) {
    this.columns = columns;
    this.root = document.createElement('div');
    this.root.className = 'row';
    this.root.setAttribute('role', 'row');
    this.cells = columns.map((c) => {
      const cell = document.createElement('div');
      cell.className = 'cell ' + c.cls;
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
      this.cells[ci].forEach((flap, i) => flap.set(text[i], rowDelay + (order++) * 14));
    });
  }
}
