import { LOCALE } from '../../i18n.js';
// Мини-график цены в карточке предмета: две линии (Bazaar — продажа и покупка; аукцион — самый дешёвый BIN и продажи),
// подписи текущих цен, периоды сутки/неделя/месяц/всё и кнопка на «Рынок» (полный биржевой график).
import { useEffect, useRef, useState } from 'react';
import { createChart, AreaSeries, LineSeries, ColorType, LineStyle } from 'lightweight-charts';
import { api, coins } from '../../api.js';
import { fmtPrice, toBars, tickLabel } from './TradingChart.jsx';
import './chart.css';

const PERIODS = [['1d', 'Сутки', '5m', 288], ['7d', 'Неделя', '1h', 168], ['30d', 'Месяц', '1h', 720], ['all', 'Всё время', '1d', 3000]];

export default function MiniChart({ id, market = 'bazaar', quote = null, onOpenMarket }) {
  const ah = market === 'ah';
  const [period, setPeriod] = useState(() => localStorage.getItem('sb-mini-period') || '7d');
  const [data, setData] = useState(null);
  const box = useRef(null), chart = useRef(null), ser = useRef(null);
  const p = PERIODS.find(x => x[0] === period) || PERIODS[1];

  useEffect(() => {
    let alive = true;
    setData(null);
    api(`/market/candles/${encodeURIComponent(id)}?tf=${p[2]}&limit=${p[3]}${ah ? '&m=ah' : ''}`).then(r => alive && setData(r)).catch(() => alive && setData({ candles: [] }));
    return () => { alive = false; };
  }, [id, period, ah]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const c = createChart(box.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#8b90b0', fontSize: 10, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(255,255,255,.04)' } },
      rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false, timeVisible: true, tickMarkFormatter: tickLabel },
      localization: { locale: LOCALE, priceFormatter: fmtPrice, timeFormatter: t => new Date(t * 1000).toLocaleString(LOCALE, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) },
      handleScroll: false, handleScale: false,
    });
    chart.current = c;
    ser.current = {
      sell: c.addSeries(AreaSeries, { lineColor: '#f5c542', topColor: 'rgba(245,197,66,.3)', bottomColor: 'rgba(245,197,66,.02)', lineWidth: 2, priceLineVisible: false }),
      buy: c.addSeries(LineSeries, { color: '#22d3ee', lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }),
    };
    return () => { c.remove(); chart.current = null; };
  }, []);

  useEffect(() => {
    if (!data?.candles || !ser.current) return;
    // Основная линия (область): Bazaar — цена продажи, аукцион — самый дешёвый BIN; пунктир — вторая цена
    const sell = toBars(data.candles, 'sell').filter(b => b.close > 0), buy = toBars(data.candles, 'buy').filter(b => b.close > 0);
    ser.current.sell.setData((ah ? buy : sell).map(b => ({ time: b.time, value: b.close })));
    ser.current.buy.setData((ah ? sell : buy).map(b => ({ time: b.time, value: b.close })));
    chart.current?.applyOptions({ timeScale: { timeVisible: p[2] !== '1d' } });
    chart.current?.timeScale().fitContent();
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = data?.candles || [];
  const k = ah ? 1 : 5; // поле открытия основной линии; закрытие — k + 3
  const first = list[0]?.[k], last = list[list.length - 1]?.[k + 3];
  const pct = first > 0 && last > 0 ? (last / first - 1) * 100 : null;
  return (
    <div className="mc">
      <div className="mc-top">
        <div className="tc-seg" role="group" aria-label="Период">
          {PERIODS.map(([v, l]) => <button key={v} type="button" className={period === v ? 'on' : ''} aria-pressed={period === v} onClick={() => { setPeriod(v); try { localStorage.setItem('sb-mini-period', v); } catch { /* приватный режим */ } }}>{l}</button>)}
        </div>
        {pct != null && <span className={`mc-chg ${pct >= 0 ? 'green' : 'red'}`} title={ah ? 'Изменение самого дешёвого лота за период' : 'Изменение цены продажи за период'}>{pct > 0 ? '+' : ''}{pct.toLocaleString(LOCALE, { maximumFractionDigits: 1 })}%</span>}
      </div>
      <div className="mc-stage">
        <div className="tc-canvas" ref={box} />
        {!data && <div className="tc-over"><div className="spinner" /></div>}
        {data && !list.length && <div className="tc-over muted small">История цены ещё копится</div>}
      </div>
      <div className="mc-top">
        <span className="muted tiny">
          {ah ? <><span className="tc-sell">━ самый дешёвый лот{quote?.buy ? ` ${coins(quote.buy)}` : ''}</span> · <span className="tc-buy">┅ продажи{quote?.sellFrom === 'sales' && quote.sell ? ` ${coins(quote.sell)}` : ''}</span></>
            : <><span className="tc-sell">━ продать{quote?.sell ? ` ${coins(quote.sell)}` : ''}</span> · <span className="tc-buy">┅ купить{quote?.buy ? ` ${coins(quote.buy)}` : ''}</span></>}
          {' · '}<a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" className="link">TradingView</a>
        </span>
      </div>
      <div className="mc-cta">
        <button type="button" className="btn mc-open" onClick={onOpenMarket}>📈 График, продажи и варианты на «Рынке» →</button>
      </div>
    </div>
  );
}
