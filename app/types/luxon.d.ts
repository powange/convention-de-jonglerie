// Minimal declaration to silence TS complaint under moduleResolution Bundler.
// Luxon v3 fournit du JS ESM mais n'expose pas de champ "types".
// Pour un typage complet, installer @types/luxon si publié.
declare module 'luxon' {
  export const DateTime: any
}
