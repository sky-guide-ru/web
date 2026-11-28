import { LOCALE } from '../../i18n.js';
// Биржевой график товара Bazaar для раздела «Рынок»: управление как на биржах.
// Свечи / полые свечи / бары / линия / область / базовая линия / Хейкен-Аши, периоды от 1 минуты до месяца,
// зум колесом и щипком, перетаскивание, перекрестие со сводкой бара, объём снизу, текущие цены покупки и продажи,
// индикаторы (скользящие средние, полосы Боллинджера, RSI, MACD), рисование (уровень, линия тренда),
// логарифмическая и процентная шкала, снимок графика, полный экран. Настройки запоминаются в браузере.
// Отрисовка — TradingView Lightweight Charts™ (Apache-2.0, ссылка на TradingView остаётся на графике).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart, CandlestickSeries, BarSeries, LineSeries, AreaSeries, BaselineSeries, HistogramSeries,
  CrosshairMode, PriceScaleMode, LineStyle, ColorType,
} from 'lightweight-charts';
import { api, saveLocal } from '../../api.js';
import { sma, ema, bollinger, rsi, macd, heikinAshi, snapTime } from './indicators.js';

export const TFS = [
  ['1m', '1м', '1 минута'], ['5m', '5м', '5 минут'], ['15m', '15м', '15 минут'], ['30m', '30м', '30 минут'],
  ['1h', '1ч', '1 час'], ['4h', '4ч', '4 часа'], ['1d', '1д', '1 день'], ['1w', '1нед', '1 неделя'], ['1M', '1мес', '1 месяц'],
];
const TYPES = [
  ['candles', 'Свечи', '🕯'], ['hollow', 'Полые свечи', '▯'], ['bars', 'Бары', '┤'], ['line', 'Линия', '╱'],
  ['area', 'Область', '◢'], ['baseline', 'Базовая линия', '⇌'], ['ha', 'Хейкен-Аши', '▥'],
];
const SETTINGS = 'sb-chart';
// Подписи для двух рынков: у Bazaar — цены мгновенной покупки и продажи, у аукциона — lowest BIN и настоящие продажи
const BZ_LABELS = {
  side: ['Покупка', 'Продажа'], legend: ['покупка', 'продажа'], line: ['покупка', 'продажа'], other: ['Цена покупки', 'Цена продажи'],
  tip: ['Цена мгновенной покупки: за сколько купишь сразу', 'Цена мгновенной продажи: за сколько продашь сразу'], vol: 'Объём (оценка)',
  empty: 'История этого товара ещё копится: сервер записывает цены Bazaar каждые 20 секунд. Первые свечи появятся через минуту, на крупных периодах — через час и через день.',
};
const AH_LABELS = {
  side: ['Lowest BIN', 'Продажи'], legend: ['lowest BIN', 'продажи'], line: ['BIN', 'продажи'], other: ['Lowest BIN', 'Цена продаж'],
  tip: ['Самый дешёвый лот Buy It Now: за сколько купишь сразу', 'Цены, по которым предмет на самом деле купили'], vol: 'Продажи, шт.',
  empty: 'История этого предмета ещё копится: сайт просматривает аукцион раз в 3 минуты. Первые свечи появятся через 5 минут, на крупных периодах — через час и через день.',
};
const DEFAULTS = {
  tf: '1h', type: 'candles', side: 'buy', other: false, lines: true, scale: 'normal', magnet: false,
  ind: { vol: true, ma: false, ema: false, bb: false, rsi: false, macd: false },
  p: { ma: 20, ema: 50, bb: 20, rsi: 14 },
};
const C = { up: '#4ade80', down: '#f87171', buy: '#22d3ee', sell: '#f5c542', text: '#8b90b0', grid: 'rgba(255,255,255,.05)', ma: '#f5c542', ema: '#c084fc', bb: '#60a5fa', rsi: '#c084fc', macd: '#22d3ee', signal: '#f59e0b' };

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS) || '{}');
    return { ...DEFAULTS, ...s, ind: { ...DEFAULTS.ind, ...s.ind }, p: { ...DEFAULTS.p, ...s.p } };
  } catch { return DEFAULTS; }
}

// Время у серий — UTC (строго по возрастанию даже при переводе часов), а подписи шкалы и перекрестия — местные
const LONG_TF = ['1d', '1w', '1M'];
/** Подпись метки на шкале времени по-местному (tickMarkType библиотеки: 0 год, 1 месяц, 2 день, 3 время, 4 время с секундами). */
export function tickLabel(t, type) {
  const d = new Date(t * 1000);
  if (type === 0) return String(d.getFullYear());
  if (type === 1) return d.toLocaleString(LOCALE, { month: 'short' }).replace('.', '');
  if (type === 2) return String(d.getDate());
  return d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', ...(type === 4 ? { second: '2-digit' } : {}) });
}
const timeLabel = (t, tf) => new Date(t * 1000).toLocaleString(LOCALE, { day: '2-digit', month: 'short', ...(LONG_TF.includes(tf) ? { year: 'numeric' } : { hour: '2-digit', minute: '2-digit' }) });

const nf = (v, d) => v.toLocaleString(LOCALE, { maximumFractionDigits: d });
/** Цена на шкале и в сводке: крупные — «12,35 млн», мелкие — с десятыми. */
export function fmtPrice(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  // До миллиарда — полным числом: при узком диапазоне (минутный график) сокращение «3,328 млн» давало одинаковые подписи шкалы
  if (a >= 1e9) return `${nf(v / 1e9, 4)} млрд`;
  if (a >= 1000) return nf(v, 0);
  if (a >= 10) return nf(v, 1);
  return nf(v, 2);
}
export const fmtVol = v => (v == null ? '—' : v >= 999_950 ? `${nf(v / 1e6, 2)} млн` : v >= 1e4 ? `${nf(v / 1e3, 1)} тыс.` : nf(v, 0));
const pctTxt = p => (p == null || !Number.isFinite(p) ? '' : `${p > 0 ? '+' : ''}${nf(p, 2)}%`);

/** Свечи API → бары нужной стороны (покупка/продажа) с местным временем. */
export function toBars(candles, side) {
  const k = side === 'sell' ? 5 : 1;
  return candles.map(c => ({ time: c[0], open: c[k], high: c[k + 1], low: c[k + 2], close: c[k + 3], bv: c[9], sv: c[10] }));
}

function Menu({ label, title, children, className = '', align = 'left' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const f = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const k = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', f, true);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('pointerdown', f, true); document.removeEventListener('keydown', k); };
  }, [open]);
  return (
    <div className={`tc-menu ${className}`} ref={ref}>
      <button type="button" className={`tc-btn ${open ? 'on' : ''}`} title={title} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(o => !o)}>{label}</button>
      {open && <div className={`tc-pop tc-pop-${align}`} role="menu" onClick={e => { if (e.target.closest('[data-close]')) setOpen(false); }}>{children}</div>}
    </div>
  );
}

const Check = ({ on, onChange, children, color }) => (
  <label className="tc-check"><input type="checkbox" checked={!!on} onChange={e => onChange(e.target.checked)} /><span className="tc-sw" style={color ? { '--c': color } : undefined} />{children}</label>
);
const Period = ({ value, onChange, min = 2, max = 400 }) => (
  <input className="tc-num" type="number" min={min} max={max} value={value} onChange={e => { const v = Math.round(Number(e.target.value)); if (v >= min && v <= max) onChange(v); }} aria-label="Период" />
);

/**
 * @param {{ id: string, name?: string, height?: number, onLive?: (live:any)=>void, market?: 'bz'|'ah', paused?: boolean }} props
 *   paused — график на скрытой вкладке «Рынка»: не опрашиваем сервер, а при возврате догружаем пропущенные свечи
 */
export default function TradingChart({ id, name, height = 520, onLive, market = 'bz', paused = false }) {
  const [s, setS] = useState(loadSettings);
  const ah = market === 'ah';
  // У аукциона минутных свечей нет (скан раз в 3 минуты): там 1 мин показывается как 5 мин
  const tf = ah && s.tf === '1m' ? '5m' : s.tf;
  const mq = ah ? '&m=ah' : '';
  const L = ah ? AH_LABELS : BZ_LABELS;
  const set = useCallback(patch => setS(prev => {
    const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
    saveLocal(SETTINGS, JSON.stringify(next));
    return next;
  }), []);
  const setInd = (k, v) => set(p => ({ ...p, ind: { ...p.ind, [k]: v } }));
  const setP = (k, v) => set(p => ({ ...p, p: { ...p.p, [k]: v } }));

  const [data, setData] = useState(null); // { candles, hasMore, live }
  const [err, setErr] = useState(null);
  const [legend, setLegend] = useState(null);
  const [tool, setTool] = useState(null); // 'h' | 't'
  const [pend, setPend] = useState(null); // первая точка линии тренда
  const [full, setFull] = useState(false);
  const [youngOff, setYoungOff] = useState(() => { try { return localStorage.getItem('sb-chart-young-off') === '1'; } catch { return false; } });
  const drawKey = `sb-chart-draw:${id}`;
  const [draw, setDraw] = useState(() => { try { return JSON.parse(localStorage.getItem(drawKey) || '[]'); } catch { return []; } });
  useEffect(() => { try { setDraw(JSON.parse(localStorage.getItem(`sb-chart-draw:${id}`) || '[]')); } catch { setDraw([]); } }, [id]);
  const saveDraw = list => { setDraw(list); saveLocal(drawKey, JSON.stringify(list)); };

  const wrap = useRef(null), box = useRef(null), chart = useRef(null), ser = useRef({ list: [], lines: [], draws: [] });
  const loadingOlder = useRef(false), fitNext = useRef(true), shiftBy = useRef(0);
  const st = useRef({});
  st.current = { data, tf: tf }; // для обработчиков библиотеки, созданных один раз

  // ---------- данные ----------
  useEffect(() => {
    let alive = true;
    setData(null); setErr(null); fitNext.current = true;
    api(`/market/candles/${encodeURIComponent(id)}?tf=${tf}&limit=1000${mq}`)
      .then(r => { if (alive) { setData(r); onLive?.(r.live); } })
      .catch(e => alive && setErr(e.message || 'не загрузилось'));
    return () => { alive = false; };
  }, [id, tf]); // eslint-disable-line react-hooks/exhaustive-deps

  // Живое обновление: последние свечи раз в 20 секунд, пока вкладка на экране.
  // После паузы (скрытая вкладка Bazaar/Auction House) берём больше свечей, чтобы закрыть пропуск.
  const wasPaused = useRef(false);
  useEffect(() => {
    if (paused) { wasPaused.current = true; return; }
    const tick = (limit = 3) => {
      if (document.hidden || !st.current.data) return;
      api(`/market/candles/${encodeURIComponent(id)}?tf=${tf}&limit=${limit}${mq}`).then(r => {
        if (!r?.candles) return;
        onLive?.(r.live);
        setData(d => {
          if (!d || d.tf !== r.tf || d.id !== r.id) return d;
          const list = d.candles.slice();
          // Ответ может захватить несколько последних свечей (например, закрытую прошлую и новую): обновляем все совпавшие
          const idx = new Map(list.slice(-r.candles.length - 2).map((c, k) => [c[0], list.length - Math.min(list.length, r.candles.length + 2) + k]));
          for (const c of r.candles) {
            if (idx.has(c[0])) list[idx.get(c[0])] = c;
            else if (!list.length || c[0] > list[list.length - 1][0]) list.push(c);
          }
          return { ...d, candles: list, live: r.live };
        });
      }).catch(() => {});
    };
    if (wasPaused.current) { wasPaused.current = false; tick(300); }
    const t = setInterval(tick, 20_000);
    return () => clearInterval(t);
  }, [id, tf, mq, paused]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadOlder = useCallback(() => {
    const d = st.current.data;
    if (!d?.hasMore || loadingOlder.current || !d.candles.length) return;
    loadingOlder.current = true;
    api(`/market/candles/${encodeURIComponent(id)}?tf=${d.tf}&limit=1000&to=${d.candles[0][0] - 1}${mq}`).then(r => {
      const older = (r.candles || []).filter(c => c[0] < d.candles[0][0]);
      shiftBy.current = older.length;
      setData(x => (x && x.tf === d.tf ? { ...x, candles: [...older, ...x.candles], hasMore: r.hasMore && older.length > 0 } : x));
    }).catch(() => {}).finally(() => { loadingOlder.current = false; });
  }, [id, mq]);

  const bars = useMemo(() => (data?.candles?.length ? toBars(data.candles, s.side) : []), [data, s.side]);
  const otherBars = useMemo(() => (data?.candles?.length ? toBars(data.candles, s.side === 'buy' ? 'sell' : 'buy') : []), [data, s.side]);

  // ---------- график ----------
  useEffect(() => {
    const c = createChart(box.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: C.text, fontFamily: 'Inter Variable, Inter, system-ui, sans-serif', fontSize: 11, attributionLogo: false, /* ссылка на TradingView — подписью под графиком (лицензия разрешает так) */ panes: { separatorColor: 'rgba(255,255,255,.08)', separatorHoverColor: 'rgba(124,92,255,.3)', enableResize: true } },
      grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: 'rgba(255,255,255,.25)', labelBackgroundColor: '#2a2e48' }, horzLine: { color: 'rgba(255,255,255,.25)', labelBackgroundColor: '#2a2e48' } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 6, barSpacing: 8, minBarSpacing: 1, tickMarkFormatter: tickLabel },
      localization: { locale: LOCALE, priceFormatter: fmtPrice, timeFormatter: t => timeLabel(t, st.current.tf) },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true, axisDoubleClickReset: true },
      kineticScroll: { touch: true, mouse: false },
    });
    chart.current = c;
    c.subscribeCrosshairMove(p => {
      const main = ser.current.main;
      if (!main) return;
      const bar = p?.time != null ? p.seriesData.get(main) : null;
      setLegend(bar ? { time: p.time, ind: ser.current.ind?.map(([label, sr, color]) => [label, p.seriesData.get(sr)?.value, color]) } : null);
    });
    c.timeScale().subscribeVisibleLogicalRangeChange(r => { if (r && r.from < 10) loadOlder(); });
    return () => { c.remove(); chart.current = null; ser.current = { list: [], lines: [], draws: [] }; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Точки рисунков ловим сами по нажатию на холст: библиотека глотает второй клик, если он быстро после первого
  const downAt = useRef(null);
  const onDown = e => { downAt.current = [e.clientX, e.clientY]; };
  const onUp = e => {
    const c = chart.current, main = ser.current.main, d0 = downAt.current;
    downAt.current = null;
    if (!tool || !c || !main || !d0 || Math.abs(e.clientX - d0[0]) + Math.abs(e.clientY - d0[1]) > 6) return;
    const r = box.current.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const price = main.coordinateToPrice(y);
    const shownBars = s.type === 'ha' ? heikinAshi(bars) : bars;
    const li = c.timeScale().coordinateToLogical(x);
    if (price == null || li == null || !shownBars.length) return;
    const time = shownBars[Math.max(0, Math.min(shownBars.length - 1, Math.round(li)))].time;
    if (tool === 'h') { saveDraw([...draw, { k: 'h', p: price }]); setTool(null); return; }
    if (!pend) { setPend({ t: time, p: price }); return; }
    const t2 = time;
    if (t2 !== pend.t) saveDraw([...draw, { k: 't', t1: Math.min(pend.t, t2), p1: pend.t < t2 ? pend.p : price, t2: Math.max(pend.t, t2), p2: pend.t < t2 ? price : pend.p }]);
    setPend(null); setTool(null);
  };

  useEffect(() => {
    const k = e => {
      if (e.key !== 'Escape') return;
      setTool(null); setPend(null);
      // запасной полный экран (iPhone) браузер сам по Esc не закрывает
      if (wrap.current?.classList.contains('tc-full')) { wrap.current.classList.remove('tc-full'); document.body.classList.remove('tc-lock'); setFull(false); }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);

  useEffect(() => { chart.current?.applyOptions({ crosshair: { mode: s.magnet ? CrosshairMode.Magnet : CrosshairMode.Normal } }); }, [s.magnet]);
  useEffect(() => {
    const mode = s.scale === 'log' ? PriceScaleMode.Logarithmic : s.scale === 'pct' ? PriceScaleMode.Percentage : PriceScaleMode.Normal;
    chart.current?.priceScale('right').applyOptions({ mode });
  }, [s.scale, s.type, s.ind]);
  useEffect(() => { chart.current?.applyOptions({ timeScale: { secondsVisible: false, timeVisible: !['1d', '1w', '1M'].includes(tf) } }); }, [tf]);

  // Серии пересоздаются при смене вида/индикаторов; при новых данных — только setData (масштаб не сбрасывается)
  const structure = JSON.stringify([s.type, s.other, s.ind, s.p, s.side]);
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    // Линии тренда — тоже серии: снимаем их вместе с остальными, иначе после смены вида остаются копии
    for (const sr of [...ser.current.list, ...(ser.current.draws || [])]) c.removeSeries(sr);
    for (let i = c.panes().length - 1; i > 0; i--) c.removePane(i);
    const list = [];
    const add = (type, opts, pane = 0) => { const sr = c.addSeries(type, opts, pane); list.push(sr); return sr; };
    const quiet = { lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false };
    const up = C.up, down = C.down;
    let main;
    if (s.type === 'candles' || s.type === 'ha') main = add(CandlestickSeries, { upColor: up, downColor: down, wickUpColor: up, wickDownColor: down, borderVisible: false });
    else if (s.type === 'hollow') main = add(CandlestickSeries, { upColor: 'rgba(0,0,0,0)', downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down, borderVisible: true });
    else if (s.type === 'bars') main = add(BarSeries, { upColor: up, downColor: down, thinBars: false });
    else if (s.type === 'line') main = add(LineSeries, { color: s.side === 'buy' ? C.buy : C.sell, lineWidth: 2 });
    else if (s.type === 'area') { const col = s.side === 'buy' ? C.buy : C.sell; main = add(AreaSeries, { lineColor: col, topColor: `${col}55`, bottomColor: `${col}05`, lineWidth: 2 }); }
    else main = add(BaselineSeries, { baseValue: { type: 'price', price: 0 }, topLineColor: up, bottomLineColor: down, topFillColor1: 'rgba(74,222,128,.25)', topFillColor2: 'rgba(74,222,128,.02)', bottomFillColor1: 'rgba(248,113,113,.02)', bottomFillColor2: 'rgba(248,113,113,.25)', lineWidth: 2 });
    main.applyOptions({ priceLineVisible: false, lastValueVisible: true, title: '' });
    const r = { main, list, lines: [], draws: [], ind: [] };
    if (s.other) r.other = add(LineSeries, { ...quiet, color: s.side === 'buy' ? C.sell : C.buy, lineWidth: 1, lineStyle: LineStyle.Dotted, autoscaleInfoProvider: () => null }); // не растягивает шкалу: спред шире минутных колебаний
    if (s.ind.vol) {
      r.vol = add(HistogramSeries, { ...quiet, priceScaleId: 'vol', priceFormat: { type: 'custom', formatter: fmtVol, minMove: 1 } });
      c.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, visible: false });
    }
    if (s.ind.ma) { r.ma = add(LineSeries, { ...quiet, color: C.ma, lineWidth: 1 }); r.ind.push([`СС ${s.p.ma}`, r.ma, C.ma]); }
    if (s.ind.ema) { r.ema = add(LineSeries, { ...quiet, color: C.ema, lineWidth: 1 }); r.ind.push([`ЭСС ${s.p.ema}`, r.ema, C.ema]); }
    if (s.ind.bb) {
      r.bbU = add(LineSeries, { ...quiet, color: C.bb, lineWidth: 1 });
      r.bbM = add(LineSeries, { ...quiet, color: C.bb, lineWidth: 1, lineStyle: LineStyle.Dashed });
      r.bbL = add(LineSeries, { ...quiet, color: C.bb, lineWidth: 1 });
      r.ind.push([`Боллинджер ${s.p.bb}: верх`, r.bbU, C.bb], ['низ', r.bbL, C.bb]);
    }
    let pane = 1;
    if (s.ind.rsi) {
      r.rsi = add(LineSeries, { color: C.rsi, lineWidth: 1, priceLineVisible: false, priceFormat: { type: 'price', precision: 1, minMove: 0.1 } }, pane);
      r.rsi.createPriceLine({ price: 70, color: 'rgba(248,113,113,.5)', lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false });
      r.rsi.createPriceLine({ price: 30, color: 'rgba(74,222,128,.5)', lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false });
      r.ind.push([`RSI ${s.p.rsi}`, r.rsi, C.rsi]);
      pane++;
    }
    if (s.ind.macd) {
      r.macdH = add(HistogramSeries, { ...quiet, priceFormat: { type: 'custom', formatter: fmtPrice, minMove: 0.01 } }, pane);
      r.macdL = add(LineSeries, { ...quiet, color: C.macd, lineWidth: 1, priceFormat: { type: 'custom', formatter: fmtPrice, minMove: 0.01 } }, pane);
      r.macdS = add(LineSeries, { ...quiet, color: C.signal, lineWidth: 1, priceFormat: { type: 'custom', formatter: fmtPrice, minMove: 0.01 } }, pane);
      r.ind.push(['MACD', r.macdL, C.macd], ['сигнал', r.macdS, C.signal]);
    }
    const panes = c.panes();
    panes[0]?.setStretchFactor(1);
    for (let i = 1; i < panes.length; i++) panes[i].setStretchFactor(0.28);
    ser.current = r;
    applyData();
  }, [structure]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyData() {
    const r = ser.current, c = chart.current;
    if (!c || !r.main) return;
    const b = s.type === 'ha' ? heikinAshi(bars) : bars;
    const lineLike = ['line', 'area', 'baseline'].includes(s.type);
    r.main.setData(lineLike ? b.map(x => ({ time: x.time, value: x.close })) : b);
    if (s.type === 'baseline' && b.length) r.main.applyOptions({ baseValue: { type: 'price', price: b[0].close } });
    r.other?.setData(otherBars.map(x => ({ time: x.time, value: x.close })));
    r.vol?.setData(bars.map(x => ({ time: x.time, value: (x.bv || 0) + (x.sv || 0), color: x.close >= x.open ? 'rgba(74,222,128,.35)' : 'rgba(248,113,113,.35)' })));
    if (r.ma) r.ma.setData(sma(bars, s.p.ma));
    if (r.ema) r.ema.setData(ema(bars, s.p.ema));
    if (r.bbU) { const bb = bollinger(bars, s.p.bb, 2); r.bbU.setData(bb.up); r.bbM.setData(bb.mid); r.bbL.setData(bb.low); }
    if (r.rsi) r.rsi.setData(rsi(bars, s.p.rsi));
    if (r.macdL) {
      const m = macd(bars);
      r.macdL.setData(m.line); r.macdS.setData(m.signal);
      r.macdH.setData(m.hist.map(p => ({ ...p, color: p.value >= 0 ? 'rgba(74,222,128,.55)' : 'rgba(248,113,113,.55)' })));
    }
    // Текущие цены покупки и продажи — линиями поперёк графика
    for (const l of r.lines) r.main.removePriceLine(l);
    r.lines = [];
    const live = data?.live;
    if (s.lines && live) {
      if (live.buy > 0) r.lines.push(r.main.createPriceLine({ price: live.buy, color: C.buy, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: L.line[0] }));
      if (live.sell > 0) r.lines.push(r.main.createPriceLine({ price: live.sell, color: C.sell, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: L.line[1] }));
    }
    // Рисунки: уровни — линиями цены, линии тренда — отрезками между барами
    for (const sr of r.draws) c.removeSeries(sr);
    r.draws = [];
    const times = b.map(x => x.time);
    for (const d of draw) {
      if (d.k === 'h') r.lines.push(r.main.createPriceLine({ price: d.p, color: '#a78bfa', lineStyle: LineStyle.Solid, lineWidth: 1, axisLabelVisible: true, title: '' }));
      else if (d.k === 't' && times.length) {
        const a = snapTime(times, d.t1), z = snapTime(times, d.t2);
        if (a == null || z == null || a === z) continue;
        const sr = c.addSeries(LineSeries, { color: '#a78bfa', lineWidth: 2, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false, pointMarkersVisible: true, pointMarkersRadius: 3, autoscaleInfoProvider: () => null }, 0);
        sr.setData([{ time: a, value: d.p1 }, { time: z, value: d.p2 }]);
        r.draws.push(sr);
      }
    }
    // Новый товар или период — показать последние ~120 свечей; подгрузка старых — сдвинуть вид, чтобы он не прыгал
    const ts = c.timeScale();
    if (fitNext.current && b.length) {
      fitNext.current = false;
      ts.setVisibleLogicalRange({ from: Math.max(-2, b.length - 120), to: b.length + 6 });
    } else if (shiftBy.current) {
      const vr = ts.getVisibleLogicalRange();
      if (vr) ts.setVisibleLogicalRange({ from: vr.from + shiftBy.current, to: vr.to + shiftBy.current });
      shiftBy.current = 0;
    }
  }
  useEffect(applyData, [bars, otherBars, draw, s.lines]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- полный экран ----------
  useEffect(() => {
    const f = () => setFull(document.fullscreenElement === wrap.current || (wrap.current?.classList.contains('tc-full') ?? false));
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);
  const toggleFull = () => {
    const el = wrap.current;
    if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
    if (el.classList.contains('tc-full')) { el.classList.remove('tc-full'); document.body.classList.remove('tc-lock'); setFull(false); return; }
    // iPhone не умеет полный экран для блока — растягиваем на всё окно сами
    if (el.requestFullscreen) el.requestFullscreen().catch(() => { el.classList.add('tc-full'); document.body.classList.add('tc-lock'); setFull(true); });
    else { el.classList.add('tc-full'); document.body.classList.add('tc-lock'); setFull(true); }
  };
  useEffect(() => () => document.body.classList.remove('tc-lock'), []);

  const shot = () => {
    const cv = chart.current?.takeScreenshot(true, false);
    if (!cv) return;
    const a = document.createElement('a');
    a.download = `${(name || id).replace(/[^\p{L}\p{N}_-]+/gu, '_')}-${tf}.png`;
    a.href = cv.toDataURL('image/png');
    a.click();
  };
  const resetView = () => {
    const c = chart.current;
    if (!c) return;
    c.priceScale('right').applyOptions({ autoScale: true });
    const n = bars.length;
    c.timeScale().setVisibleLogicalRange({ from: Math.max(-2, n - 120), to: n + 6 });
  };

  // ---------- сводка ----------
  // Сводка над графиком: бар под перекрестием, иначе последний (для Хейкен-Аши — сглаженный)
  const shown = s.type === 'ha' ? heikinAshi(bars) : bars;
  const lgI = legend?.time != null ? bars.findIndex(x => x.time === legend.time) : bars.length - 1;
  const lgBar = lgI >= 0 ? bars[lgI] : null;
  const lg = lgI >= 0 ? shown[lgI] : null;
  const chg = lg ? lg.close - lg.open : null;
  const tfInfo = TFS.find(t => t[0] === tf);
  const typeInfo = TYPES.find(t => t[0] === s.type) || TYPES[0];
  const timeTxt = t => timeLabel(t, tf);

  const toEnd = () => chart.current?.timeScale().scrollToRealTime();
  const scaleItems = <>
    {[['normal', 'Обычная'], ['log', 'Логарифмическая'], ['pct', 'В процентах']].map(([v, l]) => <button key={v} type="button" data-close className={`tc-item ${s.scale === v ? 'on' : ''}`} onClick={() => set({ scale: v })}>{l}</button>)}
    <button type="button" data-close className="tc-item" onClick={resetView}>Сбросить масштаб</button>
  </>;
  return (
    <div className={`tc ${full ? 'is-full' : ''}`} ref={wrap}>
      <div className="tc-bar" role="toolbar" aria-label="Управление графиком">
        <div className="tc-tfs" role="group" aria-label="Период свечи">
          {TFS.filter(([v]) => !ah || v !== '1m').map(([v, l, t]) => <button key={v} type="button" className={`tc-tf ${tf === v ? 'on' : ''}`} title={t} aria-pressed={tf === v} onClick={() => set({ tf: v })}>{l}</button>)}
        </div>
        <span className="tc-sep" />
        <Menu label={<><span aria-hidden>{typeInfo[2]}</span><span className="tc-lbl">{typeInfo[1]}</span></>} title="Вид графика">
          {TYPES.map(([v, l, ic]) => <button key={v} type="button" data-close className={`tc-item ${s.type === v ? 'on' : ''}`} onClick={() => set({ type: v })}><span className="tc-ic" aria-hidden>{ic}</span>{l}</button>)}
        </Menu>
        <Menu label={<><span aria-hidden>ƒx</span><span className="tc-lbl">Индикаторы</span>{Object.entries(s.ind).filter(([k, v]) => v && k !== 'vol').length > 0 && <b className="tc-count">{Object.entries(s.ind).filter(([k, v]) => v && k !== 'vol').length}</b>}</>} title="Индикаторы">
          <div className="tc-pop-h">На графике цены</div>
          <div className="tc-row"><Check on={s.ind.ma} onChange={v => setInd('ma', v)} color={C.ma}>Скользящая средняя</Check><Period value={s.p.ma} onChange={v => setP('ma', v)} /></div>
          <div className="tc-row"><Check on={s.ind.ema} onChange={v => setInd('ema', v)} color={C.ema}>Экспоненциальная средняя</Check><Period value={s.p.ema} onChange={v => setP('ema', v)} /></div>
          <div className="tc-row"><Check on={s.ind.bb} onChange={v => setInd('bb', v)} color={C.bb}>Полосы Боллинджера</Check><Period value={s.p.bb} onChange={v => setP('bb', v)} /></div>
          <div className="tc-pop-h">Отдельно снизу</div>
          <div className="tc-row"><Check on={s.ind.vol} onChange={v => setInd('vol', v)} color="#64748b">{L.vol}</Check></div>
          <div className="tc-row"><Check on={s.ind.rsi} onChange={v => setInd('rsi', v)} color={C.rsi}>Индекс силы (RSI)</Check><Period value={s.p.rsi} onChange={v => setP('rsi', v)} /></div>
          <div className="tc-row"><Check on={s.ind.macd} onChange={v => setInd('macd', v)} color={C.macd}>Схождение средних (MACD)</Check></div>
          <div className="tc-pop-h">Цены</div>
          <div className="tc-row"><Check on={s.other} onChange={v => set({ other: v })} color={s.side === 'buy' ? C.sell : C.buy}>{s.side === 'buy' ? L.other[1] : L.other[0]} пунктиром</Check></div>
          <div className="tc-row"><Check on={s.lines} onChange={v => set({ lines: v })} color={C.buy}>Текущие цены линиями</Check></div>
        </Menu>
        <Menu label={<><span aria-hidden>✎</span><span className="tc-lbl">Рисовать</span>{draw.length > 0 && <b className="tc-count">{draw.length}</b>}</>} title="Рисование">
          <button type="button" data-close className={`tc-item ${tool === 'h' ? 'on' : ''}`} onClick={() => { setTool('h'); setPend(null); }}><span className="tc-ic" aria-hidden>━</span>Горизонтальный уровень</button>
          <button type="button" data-close className={`tc-item ${tool === 't' ? 'on' : ''}`} onClick={() => { setTool('t'); setPend(null); }}><span className="tc-ic" aria-hidden>╱</span>Линия тренда</button>
          {draw.length > 0 && <>
            <div className="tc-pop-h">Нарисовано</div>
            {draw.map((d, i) => (
              <div key={i} className="tc-row tc-draw">
                <span>{d.k === 'h' ? `Уровень ${fmtPrice(d.p)}` : `Линия ${fmtPrice(d.p1)} → ${fmtPrice(d.p2)}`}</span>
                <button type="button" className="x-btn" aria-label="Удалить" title="Удалить" onClick={() => saveDraw(draw.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <button type="button" data-close className="tc-item danger" onClick={() => saveDraw([])}><span className="tc-ic" aria-hidden>🗑</span>Удалить всё</button>
          </>}
        </Menu>
        <div className="tc-seg" role="group" aria-label="Какая цена">
          <button type="button" className={s.side === 'buy' ? 'on buy' : ''} aria-pressed={s.side === 'buy'} title={L.tip[0]} onClick={() => set({ side: 'buy' })}>{L.side[0]}</button>
          <button type="button" className={s.side === 'sell' ? 'on sell' : ''} aria-pressed={s.side === 'sell'} title={L.tip[1]} onClick={() => set({ side: 'sell' })}>{L.side[1]}</button>
        </div>
        <span className="tc-grow" />
        <Menu className="tc-desk" align="right" label={<><span aria-hidden>↕</span><span>{s.scale === 'log' ? 'Шкала: лог.' : s.scale === 'pct' ? 'Шкала: %' : 'Шкала'}</span></>} title="Шкала цены">
          {scaleItems}
        </Menu>
        <button type="button" className={`tc-btn tc-desk ${s.magnet ? 'on' : ''}`} title="Магнит: перекрестие прилипает к ценам свечей" aria-pressed={s.magnet} onClick={() => set({ magnet: !s.magnet })}><span aria-hidden>🧲</span><span className="tc-lbl">Магнит</span></button>
        <button type="button" className="tc-btn tc-desk" title="Прокрутить к последней свече" onClick={toEnd}><span aria-hidden>⇥</span><span className="tc-lbl">К концу</span></button>
        <button type="button" className="tc-btn tc-desk" title="Сохранить снимок графика картинкой" onClick={shot}><span aria-hidden>📷</span><span className="tc-lbl">Снимок</span></button>
        <button type="button" className="tc-btn tc-desk" title={full ? 'Выйти из полного экрана (Esc)' : 'Во весь экран'} aria-pressed={full} onClick={toggleFull}><span aria-hidden>{full ? '🗗' : '⛶'}</span><span className="tc-lbl">{full ? 'Свернуть' : 'Весь экран'}</span></button>
        {/* На телефоне редкие кнопки спрятаны в одно меню «⋯», чтобы панель влезла в две строки */}
        <Menu className="tc-more" align="right" label={<span aria-hidden>⋯</span>} title="Ещё: шкала, магнит, снимок, весь экран">
          <button type="button" data-close className="tc-item" onClick={toggleFull}><span className="tc-ic" aria-hidden>{full ? '🗗' : '⛶'}</span>{full ? 'Свернуть' : 'Во весь экран'}</button>
          <button type="button" data-close className="tc-item" onClick={toEnd}><span className="tc-ic" aria-hidden>⇥</span>К последней свече</button>
          <button type="button" data-close className="tc-item" onClick={shot}><span className="tc-ic" aria-hidden>📷</span>Снимок картинкой</button>
          <div className="tc-row"><Check on={s.magnet} onChange={v => set({ magnet: v })}>Магнит к ценам свечей</Check></div>
          <div className="tc-pop-h">Шкала цены</div>
          {scaleItems}
        </Menu>
      </div>

      {!youngOff && data?.candles?.length > 0 && data.candles.length < 30 && ['1m', '5m', '15m', '30m'].includes(tf) && (
        <div className="tc-note">
          <span>Мелкие свечи копятся с {timeLabel(data.candles[0][0], '1m')}, раньше сайт цены не записывал. Прошлые дни есть на <button type="button" className="link-btn" onClick={() => set({ tf: '1h' })}>часовом графике</button>.</span>
          <button type="button" className="x-btn" aria-label="Скрыть подсказку" title="Скрыть подсказку" onClick={() => { setYoungOff(true); try { localStorage.setItem('sb-chart-young-off', '1'); } catch { /* приватный режим */ } }}>×</button>
        </div>
      )}
      <div className="tc-stage" style={full ? undefined : { height }}>
        <div className="tc-legend" aria-live="off">
          <div className="tc-lg-head"><b>{name || id}</b> · {tfInfo?.[2]} · <span className={s.side === 'buy' ? 'tc-buy' : 'tc-sell'}>{s.side === 'buy' ? L.legend[0] : L.legend[1]}</span>{lgBar && <span className="muted"> · {timeTxt(legend?.time ?? lgBar.time)}</span>}</div>
          {lg && <div className="tc-ohlc"><span className="tc-lg-x">Откр. <b>{fmtPrice(lg.open)}</b></span><span className="tc-lg-x">Макс. <b>{fmtPrice(lg.high)}</b></span><span className="tc-lg-x">Мин. <b>{fmtPrice(lg.low)}</b></span><span>Закр. <b className={chg >= 0 ? 'green' : 'red'}>{fmtPrice(lg.close)}</b></span>{lg.open ? <span className={chg >= 0 ? 'green' : 'red'}>{pctTxt((lg.close / lg.open - 1) * 100)}</span> : null}</div>}
          {s.ind.vol && lgBar && (ah
            ? <div className="tc-ohlc tc-lg-vol"><span>Продано <b>{fmtVol(lgBar.sv || 0)}</b> шт.</span></div>
            : <div className="tc-ohlc tc-lg-vol"><span>Объём ≈ <b>{fmtVol((lgBar.bv || 0) + (lgBar.sv || 0))}</b></span><span className="muted">куплено {fmtVol(lgBar.bv)} · продано {fmtVol(lgBar.sv)}</span></div>)}
          {legend?.ind?.some(x => x[1] != null) && <div className="tc-ohlc">{legend.ind.filter(x => x[1] != null).map(([l, v, col]) => <span key={l} style={{ color: col }}>{l} <b>{l.startsWith('RSI') ? nf(v, 1) : fmtPrice(v)}</b></span>)}</div>}
        </div>
        {tool && <div className="tc-hint">{tool === 'h' ? 'Нажми на график, чтобы поставить уровень' : pend ? 'Теперь нажми вторую точку линии' : 'Нажми первую точку линии тренда'} · <button type="button" className="link-btn" onClick={() => { setTool(null); setPend(null); }}>отмена</button></div>}
        <div className={`tc-canvas ${tool ? 'drawing' : ''}`} ref={box} onPointerDown={onDown} onPointerUp={onUp} />
        {!data && !err && <div className="tc-over"><div className="spinner" /></div>}
        {err && <div className="tc-over muted">График не загрузился: {err}</div>}
        {data && !data.candles.length && <div className="tc-over muted tc-empty">{L.empty}</div>}
      </div>
    </div>
  );
}
