export const THEME_STORAGE_KEY = 'eurorack-theme';
export const THEME_MODE_STORAGE_KEY = 'eurorack-theme-mode';

export function readMidiToolTheme(storage = globalThis.localStorage) {
    try {
        return {
            theme: storage?.getItem(THEME_STORAGE_KEY) === 'classic' ? 'classic' : 'industrial',
            mode: storage?.getItem(THEME_MODE_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
        };
    } catch {
        return { theme: 'industrial', mode: 'light' };
    }
}

export function applyMidiToolTheme({ root = document.documentElement, storage = globalThis.localStorage } = {}) {
    const { theme, mode } = readMidiToolTheme(storage);
    root.classList.remove('theme-industrial', 'theme-classic', 'theme-light', 'theme-dark');
    root.classList.add(`theme-${theme}`, `theme-${mode}`);
    return { theme, mode };
}

if (typeof document !== 'undefined') {
    applyMidiToolTheme();
    globalThis.addEventListener?.('storage', event => {
        if (event.key === THEME_STORAGE_KEY || event.key === THEME_MODE_STORAGE_KEY) {
            applyMidiToolTheme();
        }
    });
}
