const LIGHT_THEME = {
  'primary-text': '#2d1b3d',
  'neutral-text': '#6b5b7a',
  'background': '#ffffff',
  'hover-background': '#f5f0fa',
  'accent-text': '#4F187E',
  'header-text': '#ffffff',
  'header-accent-text': '#8B4FC7',
  'header-background': '#4F187E',
  'footer-text': '#ffffff',
  'footer-neutral-text': '#b8a5d1',
  'footer-background': '#3A125F',
};
const DARK_THEME = {
  'primary-text': '#e8dff5',
  'neutral-text': '#b8a5d1',
  'background': '#1a0f2e',
  'hover-background': '#2d1b3d',
  'accent-text': '#8B4FC7',
  'header-text': '#ffffff',
  'header-accent-text': '#a66dd4',
  'header-background': '#4F187E',
  'footer-text': '#ffffff',
  'footer-neutral-text': '#b8a5d1',
  'footer-background': '#3A125F',
};

const LOCAL_STORAGE_THEME = 'registryUiTheme';

let THEME;

const normalizeKey = (k) =>
  k
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^theme-/, '');

const preferDarkMode = ({ theme }) => {
  if (theme === 'auto' || theme === '') {
    switch (localStorage.getItem(LOCAL_STORAGE_THEME)) {
      case 'dark':
        return true;
      case 'light':
        return false;
      default:
        if (typeof window.matchMedia === 'function') {
          const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
          return prefersDarkScheme && prefersDarkScheme.matches;
        }
    }
  }
  return theme === 'dark';
};

export const loadTheme = (props, style) => {
  const isDarkMode = preferDarkMode(props);
  THEME = isDarkMode ? { ...DARK_THEME } : { ...LIGHT_THEME };
  Object.entries(props)
    .filter(([k, v]) => v && /^theme[A-Z]/.test(k))
    .map(([k, v]) => [normalizeKey(k), v])
    .forEach(([k, v]) => (THEME[k] = v));
  Object.entries(THEME).forEach(([k, v]) => style.setProperty(`--${k}`, v));
  const theme = isDarkMode ? 'dark' : 'light';
  localStorage.setItem(LOCAL_STORAGE_THEME, theme);
  return theme;
};
