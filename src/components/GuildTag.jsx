// Тег гильдии Hypixel ([SBK]) цветом, как в игре. Цвета чуть светлее игровых, чтобы читались на тёмном фоне.
const COLORS = {
  BLACK: '#9aa0aa', DARK_BLUE: '#6b7cff', DARK_GREEN: '#3fbf5f', DARK_AQUA: '#3fd6d6', DARK_RED: '#ff5e5e', DARK_PURPLE: '#c879ff',
  GOLD: '#ffaa00', GRAY: '#b8bcc6', DARK_GRAY: '#8a8f99', BLUE: '#7c8cff', GREEN: '#55ff55', AQUA: '#55ffff', RED: '#ff6b6b',
  LIGHT_PURPLE: '#ff77ff', YELLOW: '#ffff55', WHITE: '#ffffff',
};

export default function GuildTag({ tag, color, title }) {
  if (!tag) return null;
  const c = COLORS[color] || COLORS.GRAY;
  return <span className="guild-chip" style={{ color: c, background: `color-mix(in srgb, ${c} 16%, transparent)` }} title={title}>[{tag}]</span>;
}
