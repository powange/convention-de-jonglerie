export type AccommodationType = 'TENT' | 'VEHICLE' | 'HOSTED' | 'OTHER'

/**
 * Définit les types d'hébergement avec leurs clés i18n
 */
export const ACCOMMODATION_TYPES: Record<AccommodationType, string> = {
  TENT: 'artists.accommodation_type_tent',
  VEHICLE: 'artists.accommodation_type_vehicle',
  HOSTED: 'artists.accommodation_type_hosted',
  OTHER: 'artists.accommodation_type_other',
}

/**
 * Retourne le label traduit d'un type d'hébergement
 */
export function getAccommodationTypeLabel(type: string, t: (key: string) => string): string {
  const key = ACCOMMODATION_TYPES[type as AccommodationType]
  return key ? t(key) : type
}

/**
 * Retourne les options formatées pour les composants de sélection (USelect, etc.)
 */
export function getAccommodationTypeSelectOptions(
  t: (key: string) => string
): Array<{ value: string; label: string }> {
  return Object.entries(ACCOMMODATION_TYPES).map(
    ([value, labelKey]): { value: string; label: string } => ({
      value,
      label: t(labelKey),
    })
  )
}
