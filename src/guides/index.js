import Rift from './Rift.jsx';
import Fishing from './Fishing.jsx';
import Trophy from './Trophy.jsx';
import Collectibles from './Collectibles.jsx';
import Forge from './Forge.jsx';
import Dragons from './Dragons.jsx';
import Bestiary from './Bestiary.jsx';

// Свои компоненты для гайдов: id гайда → компонент ({ guide, state }).
// Гайды без своего компонента рисуются общим рендером (GenericGuide из parts.jsx).

export const CUSTOM = {
  fishing: Fishing,
  trophy: Trophy,
  rift: Rift,
  collectibles: Collectibles,
  forge: Forge,
  dragons: Dragons,
  bestiary: Bestiary,
};
