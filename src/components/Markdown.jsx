// Небольшой безопасный рендер markdown для ответов советчика: абзацы, списки, **жирный**, *курсив*, `код`.
// Без dangerouslySetInnerHTML: строим React-элементы, так что HTML из ответа не выполняется.
// [[ID|Название]] — предмет: кнопка, которая открывает его карточку (если передан onItem).
import { Fragment, useState } from 'react';
import { ItemIcon } from './ItemIcon.jsx';
import { Rich } from '../guides/Rich.jsx'; // внутри RefsProvider подсвечивает NPC, мобов, места и механики

const MASTER = { '➊': 1, '➋': 2, '➌': 3, '➍': 4, '➎': 5 };

/** Значки звёзд SkyBlock (✪✪✪✪✪➊) многие шрифты рисуют кружками — заменяем на «5★+1» */
export function fixStars(text) {
  return String(text || '').replace(/(✪+)\s*([➊➋➌➍➎])?/g, (_, s, m) => `${s.length}★${m ? `+${MASTER[m]}` : ''}`).replace(/[➊➋➌➍➎]/g, c => `+${MASTER[c]}★`);
}

function inline(text, keyBase, onItem) {
  const out = [];
  // подчёркивания только по краям слов, чтобы ENCHANTED_DIAMOND_BLOCK не превращался в курсив
  const re = /(\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\*\*([^*]+)\*\*|(?<!\w)__([^_]+)__(?!\w)|`([^`]+)`|\*([^*\s][^*]*)\*|(?<!\w)_([^_\s][^_]*)_(?!\w))/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(<Rich key={`${keyBase}-t${i}`} text={text.slice(last, m.index)} />);
    const k = `${keyBase}-${i++}`;
    if (m[2]) {
      const id = m[2].trim(), label = (m[3] || id).trim();
      out.push(onItem
        ? <button key={k} type="button" className="md-item" onClick={() => onItem(id)} title="Открыть карточку предмета"><ItemIcon id={id} size={16} />{label}</button>
        : <b key={k}>{label}</b>);
    } else if (m[4] || m[5]) out.push(<b key={k}>{m[4] || m[5]}</b>);
    else if (m[6]) out.push(<code key={k}>{m[6]}</code>);
    else out.push(<i key={k}>{m[7] || m[8]}</i>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(<Rich key={`${keyBase}-end`} text={text.slice(last)} />);
  return out;
}

/** collapse — сколько блоков показывать сразу; остальное под «Показать полностью» */
export default function Markdown({ text, className = '', onItem = null, collapse = 0 }) {
  const [open, setOpen] = useState(false);
  const lines = fixStars(text).replace(/\r/g, '').split('\n');
  const blocks = [];
  let list = null;
  const flush = () => { if (list) { blocks.push(list); list = null; } };
  lines.forEach((raw, n) => {
    const line = raw.trimEnd();
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (ul || ol) {
      const type = ul ? 'ul' : 'ol';
      if (!list || list.type !== type) { flush(); list = { type, items: [] }; }
      list.items.push(ul ? ul[1] : ol[2]);
      return;
    }
    flush();
    if (!line.trim()) { blocks.push({ type: 'gap' }); return; }
    const h = line.match(/^#{1,6}\s+(.*)$/);
    blocks.push({ type: h ? 'h' : 'p', text: h ? h[1] : line, n });
  });
  flush();
  const shown = blocks.filter(b => b.type !== 'gap');
  const cut = collapse && !open && shown.length > collapse + 1 ? collapse : 0;
  return (
    <div className={`md ${className}`}>
      {(cut ? shown.slice(0, cut) : shown).map((b, i) => {
        if (b.type === 'gap') return null;
        if (b.type === 'ul' || b.type === 'ol') {
          const Tag = b.type;
          return <Tag key={i}>{b.items.map((t, j) => <li key={j}>{inline(t, `${i}-${j}`, onItem)}</li>)}</Tag>;
        }
        if (b.type === 'h') return <p key={i}><b>{inline(b.text, i, onItem)}</b></p>;
        return <p key={i}>{inline(b.text, i, onItem)}</p>;
      }).map((el, i) => <Fragment key={i}>{el}</Fragment>)}
      {cut ? <button type="button" className="md-more" onClick={() => setOpen(true)}>Показать полностью ↓</button> : null}
    </div>
  );
}
