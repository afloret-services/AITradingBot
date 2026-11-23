/** shadcn/ui-style tokens */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: {
      border: 'hsl(var(--border))', input: 'hsl(var(--input))', ring: 'hsl(var(--ring))',
      background: 'hsl(var(--background))', foreground: 'hsl(var(--foreground))',
      primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
      secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
      muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
      accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
      destructive: { DEFAULT: 'hsl(var(--destructive))' },
      card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
      // accent: the green palette coolors.co/palette/d8f3dc-b7e4c7-95d5b2-74c69d-52b788-40916c-2d6a4f-1b4332-081c15,
      // put in place of Tailwind's sky so every sky-* accent (links, values, selection, descriptions) uses it
      sky: { 50: '#d8f3dc', 100: '#d8f3dc', 200: '#b7e4c7', 300: '#95d5b2', 400: '#74c69d', 500: '#52b788', 600: '#40916c', 700: '#2d6a4f', 800: '#1b4332', 900: '#081c15', 950: '#081c15' },
    },
    borderRadius: { xl: '0.875rem', lg: '0.625rem', md: '0.5rem', sm: '0.3rem' },
    boxShadow: { card: '0 1px 0 0 hsl(0 0% 100% / 0.03) inset, 0 8px 24px -12px rgb(0 0 0 / 0.6)' },
  } },
};
