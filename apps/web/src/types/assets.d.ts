// Ambient declarations for side-effect asset imports (e.g. global stylesheets).
// Next.js does not ship a type for plain `.css` imports, so stricter TS servers
// report TS2882 on `import '@/theme/globals.css'` without this.
declare module '*.css';
