export type BrandKey =
  | 'emerald'
  | 'blue'
  | 'violet'
  | 'orange'
  | 'rose'
  | 'slate';

type Palette = Record<string, string>;

export const BRAND_PALETTES: Record<BrandKey, Palette> = {
  emerald: {
    '50': '#ecfdf5',
    '100': '#d1fae5',
    '200': '#a7f3d0',
    '300': '#6ee7b7',
    '400': '#34d399',
    '500': '#10b981',
    '600': '#059669',
    '700': '#047857',
    '800': '#065f46',
    '900': '#064e3b',
    '950': '#022c22',
  },
  blue: {
    '50': '#eff6ff',
    '100': '#dbeafe',
    '200': '#bfdbfe',
    '300': '#93c5fd',
    '400': '#60a5fa',
    '500': '#3b82f6',
    '600': '#2563eb',
    '700': '#1d4ed8',
    '800': '#1e40af',
    '900': '#1e3a8a',
    '950': '#172554',
  },
  violet: {
    '50': '#f5f3ff',
    '100': '#ede9fe',
    '200': '#ddd6fe',
    '300': '#c4b5fd',
    '400': '#a78bfa',
    '500': '#8b5cf6',
    '600': '#7c3aed',
    '700': '#6d28d9',
    '800': '#5b21b6',
    '900': '#4c1d95',
    '950': '#2e1065',
  },
  orange: {
    '50': '#fff7ed',
    '100': '#ffedd5',
    '200': '#fed7aa',
    '300': '#fdba74',
    '400': '#fb923c',
    '500': '#f97316',
    '600': '#ea580c',
    '700': '#c2410c',
    '800': '#9a3412',
    '900': '#7c2d12',
    '950': '#431407',
  },
  rose: {
    '50': '#fff1f2',
    '100': '#ffe4e6',
    '200': '#fecdd3',
    '300': '#fda4af',
    '400': '#fb7185',
    '500': '#f43f5e',
    '600': '#e11d48',
    '700': '#be123c',
    '800': '#9f1239',
    '900': '#881337',
    '950': '#4c0519',
  },
  slate: {
    '50': '#f8fafc',
    '100': '#f1f5f9',
    '200': '#e2e8f0',
    '300': '#cbd5e1',
    '400': '#94a3b8',
    '500': '#64748b',
    '600': '#475569',
    '700': '#334155',
    '800': '#1e293b',
    '900': '#0f172a',
    '950': '#020617',
  },
};

export const BRAND_LABELS: Record<BrandKey, string> = {
  emerald: 'Verde',
  blue: 'Azul',
  violet: 'Violeta',
  orange: 'Laranja',
  rose: 'Vermelho',
  slate: 'Grafite',
};

export const BRAND_KEYS: BrandKey[] = [
  'emerald',
  'blue',
  'violet',
  'orange',
  'rose',
  'slate',
];

export function applyBrandColor(key: string | undefined | null): void {
  const palette =
    BRAND_PALETTES[(key as BrandKey) ?? 'emerald'] ?? BRAND_PALETTES.emerald;
  const root = document.documentElement;
  for (const [shade, color] of Object.entries(palette)) {
    root.style.setProperty(`--color-brand-${shade}`, color);
  }
}
