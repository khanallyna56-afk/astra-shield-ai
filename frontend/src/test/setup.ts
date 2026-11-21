import '@testing-library/jest-dom/vitest';

// jsdom lacks these browser APIs used by MUI / Plotly.
window.matchMedia ??= ((q: string) => ({ matches: false, media: q, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
window.URL.createObjectURL ??= () => '';
