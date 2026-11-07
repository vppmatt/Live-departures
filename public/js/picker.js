// The drop-down under the airport name: preferred airports, then (for airports with more than
// one terminal) a second step to choose a terminal or "All terminals".
import { terminalsFor, termLabel } from './airports.js';

export function initPicker({ root, button, menu, getAirports, getSel, onSelect, onEdit }) {
  let isOpen = false;

  const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls || '', textContent: text ?? '' });
  function item(label, { sub = '', current = false, chevron = false, onClick, cls = '' }) {
    const b = el('button', 'item ' + cls);
    b.type = 'button'; b.setAttribute('role', 'menuitem');
    if (current) b.setAttribute('aria-current', 'true');
    b.append(el('span', 'check', current ? '✓' : ''), el('span', 'lbl', label));
    if (sub) b.append(el('span', 'sub', sub));
    if (chevron) b.append(el('span', 'chev', '›'));
    b.addEventListener('click', onClick);
    return b;
  }

  function listStep() {
    const sel = getSel();
    const nodes = getAirports().map((a) => {
      const multi = terminalsFor(a).length > 1;
      return item(a.name, {
        sub: a.iata, current: a.iata === sel.iata, chevron: multi,
        onClick: () => (multi ? termStep(a) : (onSelect(a.iata, null), close())),
      });
    });
    nodes.push(item('Edit airports…', { cls: 'edit', onClick: () => { close(); onEdit(); } }));
    menu.replaceChildren(...nodes);
    menu.querySelector('.item')?.focus();
  }

  function termStep(a) {
    const sel = getSel();
    const here = sel.iata === a.iata;
    const back = item(`${a.name} (${a.iata})`, { cls: 'back', onClick: listStep });
    back.firstChild.textContent = '‹';
    const all = item('All terminals', { current: here && !sel.terminal, onClick: () => (onSelect(a.iata, null), close()) });
    const terms = terminalsFor(a).map((t) => item(termLabel(t), { current: here && sel.terminal === t, onClick: () => (onSelect(a.iata, t), close()) }));
    menu.replaceChildren(back, all, ...terms);
    all.focus();
  }

  function open() { listStep(); menu.hidden = false; isOpen = true; button.setAttribute('aria-expanded', 'true'); }
  function close() { menu.hidden = true; isOpen = false; button.setAttribute('aria-expanded', 'false'); }

  button.addEventListener('click', () => (isOpen ? close() : open()));
  document.addEventListener('pointerdown', (e) => { if (isOpen && !root.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') { close(); button.focus(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const items = [...menu.querySelectorAll('.item')];
      const i = items.indexOf(document.activeElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      e.preventDefault();
    }
  });
  return { close };
}
