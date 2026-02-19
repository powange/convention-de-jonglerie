/**
 * Types de zones et marqueurs pour la carte d'édition
 * Ce fichier centralise les constantes utilisées côté client et serveur
 */

// Liste des types de zones/marqueurs (correspond à l'enum Prisma EditionZoneType)
export const EDITION_ZONE_TYPES = [
  'CAMPING',
  'PARKING',
  'SHOWS',
  'WORKSHOPS',
  'FOOD',
  'MARKET',
  'ENTRANCE',
  'TOILETS',
  'SHOWER',
  'INFO',
  'GYM',
  'OTHER',
] as const

export type EditionZoneType = (typeof EDITION_ZONE_TYPES)[number]

// Couleurs par type (utilisées pour les marqueurs sur la carte)
export const ZONE_TYPE_COLORS: Record<EditionZoneType, string> = {
  CAMPING: '#22c55e',
  PARKING: '#3b82f6',
  SHOWS: '#8b5cf6',
  WORKSHOPS: '#f59e0b',
  FOOD: '#ef4444',
  MARKET: '#ec4899',
  ENTRANCE: '#06b6d4',
  TOILETS: '#64748b',
  SHOWER: '#0891b2',
  INFO: '#0ea5e9',
  GYM: '#d97706',
  OTHER: '#6b7280',
}

// Icônes Lucide par type (utilisées dans la légende et les modals)
export const ZONE_TYPE_ICONS: Record<EditionZoneType, string> = {
  CAMPING: 'i-lucide-tent',
  PARKING: 'i-lucide-square-parking',
  SHOWS: 'i-lucide-theater',
  WORKSHOPS: 'i-lucide-hammer',
  FOOD: 'i-lucide-utensils',
  MARKET: 'i-lucide-shopping-bag',
  ENTRANCE: 'i-lucide-door-open',
  TOILETS: 'i-lucide-toilet',
  SHOWER: 'i-lucide-shower-head',
  INFO: 'i-lucide-info',
  GYM: 'i-lucide-warehouse',
  OTHER: 'i-lucide-map-pin',
}

// Icônes SVG par type (utilisées pour les marqueurs Leaflet)
export const ZONE_TYPE_SVG_ICONS: Record<EditionZoneType, string> = {
  CAMPING: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 21 14 3"/><path d="M20.5 21 10 3"/><path d="M3.5 21h17"/><path d="M7 21v-4"/><path d="M17 21v-4"/></svg>`,
  PARKING: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg>`,
  SHOWS: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.58 16.5h12.85"/></svg>`,
  WORKSHOPS: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/></svg>`,
  FOOD: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`,
  MARKET: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
  ENTRANCE: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3"/><path d="M13 20h9"/><path d="M10 12v.01"/><path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z"/></svg>`,
  TOILETS: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 12h13a1 1 0 0 1 1 1 5 5 0 0 1-5 5h-.598a.5.5 0 0 0-.424.765l1.544 2.47a.5.5 0 0 1-.424.765H5.402a.5.5 0 0 1-.424-.765L7 18"/><path d="M8 18a5 5 0 0 1-5-5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8"/></svg>`,
  SHOWER: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 4 2.5 2.5"/><path d="M13.5 6.5a4.95 4.95 0 0 0-7 7"/><path d="M15 5 5 15"/><path d="M14 17v.01"/><path d="M10 16v.01"/><path d="M13 13v.01"/><path d="M16 10v.01"/><path d="M11 20v.01"/><path d="M17 14v.01"/><path d="M20 11v.01"/></svg>`,
  INFO: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  GYM: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16"/><path d="M4 20V9a2 2 0 0 1 .874-1.657l7-4.667a2 2 0 0 1 2.252 0l7 4.667A2 2 0 0 1 22 9v11"/><path d="M8 20v-6h8v6"/></svg>`,
  OTHER: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
}

// Limites pour éviter les abus
export const ZONE_LIMITS = {
  MAX_ZONES_PER_EDITION: 50,
  MAX_MARKERS_PER_EDITION: 100,
  MAX_NAME_LENGTH: 100,
  MIN_POLYGON_POINTS: 3,
} as const

// Helper pour obtenir la couleur d'un type
export const getZoneTypeColor = (type: string): string => {
  return ZONE_TYPE_COLORS[type as EditionZoneType] || ZONE_TYPE_COLORS.OTHER
}

// Helper pour obtenir l'icône Lucide d'un type
export const getZoneTypeIcon = (type: string): string => {
  return ZONE_TYPE_ICONS[type as EditionZoneType] || ZONE_TYPE_ICONS.OTHER
}

// Helper pour obtenir l'icône SVG d'un type
export const getZoneTypeSvgIcon = (type: string): string => {
  return ZONE_TYPE_SVG_ICONS[type as EditionZoneType] || ZONE_TYPE_SVG_ICONS.OTHER
}
