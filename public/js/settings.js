// Settings dialog: RapidAPI key and the list of preferred airports. Edits are held in a draft
// and only applied on Save.
import { AIRPORTS } from './airports.js';
import { findAirport } from './departures.js';

export function initSettings({ dlg, openButton, getKey, getAirports, onSave }) {
  const $ = (id) => document.getElementById(id);
  let draft = [];

  const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls || '', textContent: text ?? '' });
  const msg = (t, err = false) => { $('apMsg').textContent = t; $('apMsg').classList.toggle('err', err); };

  function renderDraft() {
    $('apList').replaceChildren(...draft.map((a, i) => {
      const li = el('li');
      const rm = el('button', 'rm', '✕');
      rm.type = 'button'; rm.setAttribute('aria-label', `Remove ${a.name}`);
      rm.disabled = draft.length === 1; rm.title = draft.length === 1 ? 'Keep at least one airport' : 'Remove';
      rm.addEventListener('click', () => { draft.splice(i, 1); msg(''); renderDraft(); });
      li.append(el('span', 'n', a.name), el('span', 'c', a.iata), rm);
      return li;
    }));
    const chips = Object.entries(AIRPORTS).filter(([c]) => !draft.some((a) => a.iata === c)).map(([c, a]) => {
      const b = el('button', 'chip', c); b.type = 'button'; b.title = a.name;
      b.addEventListener('click', () => add(c));
      return b;
    });
    $('apChips').replaceChildren(...chips);
    $('apChipsWrap').hidden = !chips.length;
  }

  async function add(raw) {
    const code = raw.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) return msg('Enter a 3-letter IATA code, e.g. MAN', true);
    if (draft.some((a) => a.iata === code)) return msg(`${code} is already in your list`, true);
    msg(`Looking up ${code}…`);
    try {
      const info = await findAirport(code, $('keyInput').value.trim());
      if (draft.some((a) => a.iata === code)) return;
      draft.push({ iata: code, name: info.name, tz: info.tz });
      $('apInput').value = '';
      msg(`Added ${info.name}`);
      renderDraft();
    } catch (err) { msg(err.message, true); }
  }

  openButton.addEventListener('click', () => {
    draft = getAirports().map((a) => ({ ...a }));
    $('keyInput').value = getKey(); $('showKey').checked = false; $('keyInput').type = 'password';
    $('apInput').value = ''; msg('');
    renderDraft();
    dlg.showModal();
  });
  $('showKey').addEventListener('change', (e) => { $('keyInput').type = e.target.checked ? 'text' : 'password'; });
  $('apAdd').addEventListener('click', () => add($('apInput').value));
  $('apInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add($('apInput').value); } });
  $('clearKey').addEventListener('click', () => { $('keyInput').value = ''; });
  $('saveKey').addEventListener('click', (e) => {
    e.preventDefault();
    onSave({ key: $('keyInput').value.trim(), airports: draft });
    dlg.close();
  });
  return { open: () => openButton.click() };
}
