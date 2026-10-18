export const locales = ['en', 'pt'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

// UI strings only. Content strings live in Keystatic (fields with en/pt).
export const ui = {
  en: {
    'nav.work': 'Work',
    'nav.index': 'Index',
    'nav.about': 'About',
    'nav.contact': 'Contact',
    'canvas.hint': 'Drag to explore',
    'canvas.hintTouch': 'Swipe to explore',
    'canvas.zoomIn': 'Zoom in',
    'canvas.zoomOut': 'Zoom out',
    'index.all': 'All',
    'index.year': 'Year',
    'index.discipline': 'Discipline',
    'index.section': 'Client',
    'project.credits': 'Credits',
    'project.prev': 'Previous',
    'project.next': 'Next',
    'project.back': 'Back',
    'project.videos': 'Videos',
    'about.skills': 'Skills',
    'about.availability': 'Availability',
    'toggle.theme': 'Toggle theme',
    'toggle.lang': 'Português',
    'a11y.close': 'Close',
    'a11y.nav': 'Main navigation',
    'index.project': 'Project',
    'index.empty': 'No projects match these filters.',
    'index.filters': 'Filters',
    'project.play': 'Play video',
    'project.gallery': 'Gallery',
    'about.location': 'Location',
    'about.social': 'Elsewhere',
    '404.title': 'Page not found',
    '404.home': 'Back to work',
  },
  pt: {
    'nav.work': 'Trabalho',
    'nav.index': 'Índice',
    'nav.about': 'Sobre',
    'nav.contact': 'Contacto',
    'canvas.hint': 'Arrasta para explorar',
    'canvas.hintTouch': 'Desliza para explorar',
    'canvas.zoomIn': 'Aproximar',
    'canvas.zoomOut': 'Afastar',
    'index.all': 'Todos',
    'index.year': 'Ano',
    'index.discipline': 'Disciplina',
    'index.section': 'Cliente',
    'project.credits': 'Créditos',
    'project.prev': 'Anterior',
    'project.next': 'Seguinte',
    'project.back': 'Voltar',
    'project.videos': 'Vídeos',
    'about.skills': 'Competências',
    'about.availability': 'Disponibilidade',
    'toggle.theme': 'Mudar tema',
    'toggle.lang': 'English',
    'a11y.close': 'Fechar',
    'a11y.nav': 'Navegação principal',
    'index.project': 'Projeto',
    'index.empty': 'Nenhum projeto corresponde a estes filtros.',
    'index.filters': 'Filtros',
    'project.play': 'Reproduzir vídeo',
    'project.gallery': 'Galeria',
    'about.location': 'Localização',
    'about.social': 'Noutros sítios',
    '404.title': 'Página não encontrada',
    '404.home': 'Voltar ao trabalho',
  },
} as const;

export type UIKey = keyof (typeof ui)['en'];

export const useT = (locale: Locale) => (key: UIKey) => ui[locale][key] ?? ui.en[key];

/** Build a localized path: localePath('pt', '/about') -> '/pt/about' */
export const localePath = (locale: Locale, path = '/') =>
  locale === defaultLocale ? path : `/${locale}${path === '/' ? '' : path}`;

/** Same page in the other locale (used by the language toggle). */
export const switchLocalePath = (pathname: string, to: Locale) => {
  const bare = pathname.replace(/^\/pt(?=\/|$)/, '') || '/';
  return localePath(to, bare);
};
