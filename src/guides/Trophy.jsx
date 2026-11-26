// Гайд «Trophy Fish»: счётчик по тирам, сетка 18 видов, затем секции (условия, шансы, план до алмаза).
import { GuideHero, NextSteps, Section } from './parts.jsx';
import { TrophyGrid } from './Fishing.jsx';

export default function Trophy({ guide }) {
  const ex = guide.extra || {};
  // Таблица «Счётчик по тирам» дублирует полоски сверху — в своём виде её не рисуем
  const sections = (guide.sections || []).filter(s => s.title !== 'Счётчик по тирам');
  return (
    <>
      <GuideHero guide={guide} />
      {ex.trophy && <TrophyGrid fish={ex.trophy} ranks={ex.ranks || []} counts={ex.counts} title="Твои трофеи: сколько видов в каждом тире" />}
      <NextSteps guide={guide} />
      {sections.map((s, i) => <Section key={i} s={s} />)}
    </>
  );
}
