// Utilitaires pour créer des marqueurs de carte personnalisés

// Échappe les caractères HTML pour prévenir les injections XSS dans les popups
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (char) => map[char])
}

// Échappe le HTML et convertit les retours à la ligne en <br/>
// L'échappement se fait AVANT le remplacement pour garantir la sécurité
export function escapeHtmlWithNewlines(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br/>')
}

export interface MarkerOptions {
  isUpcoming: boolean
  isOngoing: boolean
  isFavorite: boolean
}

// Générer une icône SVG personnalisée avec couleur et contour conditionnel
export function createCustomMarkerIcon(L: unknown, options: MarkerOptions): unknown {
  const { isUpcoming, isOngoing, isFavorite } = options

  // Déterminer la couleur principale basée sur le statut temporel
  let fillColor: string
  if (isOngoing) {
    fillColor = '#10b981' // Vert pour "en cours"
  } else if (isUpcoming) {
    fillColor = '#3b82f6' // Bleu pour "à venir"
  } else {
    fillColor = '#6b7280' // Gris pour "passé"
  }

  // Couleur du contour (jaune si favori, sinon plus foncé que le remplissage)
  const strokeColor = isFavorite ? '#eab308' : '#1f2937'
  const strokeWidth = isFavorite ? 3 : 1

  // Créer le SVG du marqueur
  const svgIcon = `
    <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 8.5 12.5 28.5 12.5 28.5s12.5-20 12.5-28.5C25 5.596 19.404 0 12.5 0z" 
            fill="${fillColor}" 
            stroke="${strokeColor}" 
            stroke-width="${strokeWidth}"/>
      <circle cx="12.5" cy="12.5" r="6" fill="white" opacity="0.9"/>
    </svg>
  `

  // Encoder le SVG en data URI (évite les fuites mémoire de URL.createObjectURL)
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgIcon)}`

  return (L as any).icon({
    iconUrl: svgUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    shadowSize: [41, 41],
  })
}

// Déterminer le statut temporel d'une édition
export function getEditionStatus(startDate: string, endDate: string) {
  const now = new Date()
  const start = new Date(startDate)
  const end = new Date(endDate)

  const isOngoing = start <= now && end >= now
  const isUpcoming = start > now

  return {
    isUpcoming,
    isOngoing,
    isPast: !isUpcoming && !isOngoing,
  }
}
