import { wrapApiHandler } from '#server/utils/api-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

// Convertit une couleur hex #RRGGBB en format KML (AABBGGRR)
function hexToKmlColor(hex: string, opacity: number = 0.5): string {
  // Enlever le # si présent
  const color = hex.replace('#', '')

  // Extraire les composantes
  const r = color.substring(0, 2)
  const g = color.substring(2, 4)
  const b = color.substring(4, 6)

  // Convertir l'opacité en hex (0-255)
  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0')

  // KML utilise le format AABBGGRR (alpha, blue, green, red)
  return `${alpha}${b}${g}${r}`
}

// Échappe les caractères spéciaux XML
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)

    // Récupérer l'édition avec ses infos
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: {
        id: true,
        name: true,
        mapPublic: true,
        convention: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!edition) {
      throw createError({
        status: 404,
        message: 'Edition not found',
      })
    }

    // Vérifier que la carte est publique
    if (!edition.mapPublic) {
      throw createError({
        status: 403,
        message: 'Map is not public',
      })
    }

    // Récupérer les zones et markers
    const [zones, markers] = await Promise.all([
      prisma.editionZone.findMany({
        where: { editionId },
        orderBy: { order: 'asc' },
      }),
      prisma.editionMarker.findMany({
        where: { editionId },
        orderBy: { order: 'asc' },
      }),
    ])

    const editionName = edition.name || edition.convention.name

    // Générer le KML
    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(editionName)}</name>
    <description>Carte du site - ${escapeXml(editionName)}</description>
`

    // Ajouter les styles pour les zones
    zones.forEach((zone) => {
      const fillColor = hexToKmlColor(zone.color, 0.4)
      const lineColor = hexToKmlColor(zone.color, 1)

      kml += `
    <Style id="zone-${zone.id}">
      <PolyStyle>
        <color>${fillColor}</color>
        <outline>1</outline>
      </PolyStyle>
      <LineStyle>
        <color>${lineColor}</color>
        <width>2</width>
      </LineStyle>
    </Style>`
    })

    // Ajouter les styles pour les markers
    markers.forEach((marker) => {
      const color = marker.color || '#3b82f6'
      const kmlColor = hexToKmlColor(color, 1)

      kml += `
    <Style id="marker-${marker.id}">
      <IconStyle>
        <color>${kmlColor}</color>
        <scale>1.2</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/paddle/wht-blank.png</href>
        </Icon>
      </IconStyle>
      <LabelStyle>
        <scale>0.8</scale>
      </LabelStyle>
    </Style>`
    })

    // Ajouter les zones (polygones)
    if (zones.length > 0) {
      kml += `
    <Folder>
      <name>Zones</name>`

      zones.forEach((zone) => {
        // Les coordonnées sont stockées en [lat, lng] (format Leaflet)
        const coordinates = zone.coordinates as [number, number][]
        // KML utilise longitude,latitude,altitude - on inverse lat/lng
        const coordString = coordinates.map(([lat, lng]) => `${lng},${lat},0`).join(' ')

        // Fermer le polygone si nécessaire (en inversant aussi lat/lng pour KML)
        const firstCoord = coordinates[0]
        const lastCoord = coordinates[coordinates.length - 1]
        const closingCoord =
          firstCoord &&
          lastCoord &&
          (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1])
            ? ` ${firstCoord[1]},${firstCoord[0]},0`
            : ''

        kml += `
      <Placemark>
        <name>${escapeXml(zone.name)}</name>
        ${zone.description ? `<description>${escapeXml(zone.description)}</description>` : ''}
        <styleUrl>#zone-${zone.id}</styleUrl>
        <Polygon>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>${coordString}${closingCoord}</coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
      </Placemark>`
      })

      kml += `
    </Folder>`
    }

    // Ajouter les markers (points)
    if (markers.length > 0) {
      kml += `
    <Folder>
      <name>Points de repère</name>`

      markers.forEach((marker) => {
        kml += `
      <Placemark>
        <name>${escapeXml(marker.name)}</name>
        ${marker.description ? `<description>${escapeXml(marker.description)}</description>` : ''}
        <styleUrl>#marker-${marker.id}</styleUrl>
        <Point>
          <coordinates>${marker.longitude},${marker.latitude},0</coordinates>
        </Point>
      </Placemark>`
      })

      kml += `
    </Folder>`
    }

    kml += `
  </Document>
</kml>`

    // Définir les headers pour le téléchargement
    const filename = `carte-${editionName.toLowerCase().replace(/[^a-z0-9]/gi, '-')}.kml`

    setHeader(event, 'Content-Type', 'application/vnd.google-earth.kml+xml')
    setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)

    return kml
  },
  { operationName: 'ExportEditionKML' }
)
