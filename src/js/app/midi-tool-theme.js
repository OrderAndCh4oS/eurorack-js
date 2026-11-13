export function applyMidiToolTheme({ root = document.documentElement } = {}) {
    root.classList.remove('theme-classic', 'theme-dark');
    root.classList.add('theme-industrial', 'theme-light');
    try {
        globalThis.localStorage?.removeItem('eurorack-theme');
        globalThis.localStorage?.removeItem('eurorack-theme-mode');
    } catch {
        // Retired preferences never affect the fixed Industrial Light appearance.
    }
    return { theme: 'industrial', mode: 'light' };
}

if (typeof document !== 'undefined') {
    applyMidiToolTheme();
}
