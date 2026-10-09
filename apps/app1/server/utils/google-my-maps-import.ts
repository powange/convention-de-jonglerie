/**
 * Lecture d'une carte Google My Maps en vue de l'importer.
 *
 * Deux sources sont nécessaires, parce qu'aucune ne suffit seule :
 *
 * - l'export KML (`/maps/d/kml?mid=…&forcekml=1`) donne une géométrie propre, dans un format
 *   standard — mais **aucun identifiant** : un placemark s'y réduit à un nom, un style et des
 *   coordonnées, et les noms ne sont pas uniques (« Toilets » revient plusieurs fois sur un
 *   terrain de festival) ;
 * - la page du visualiseur (`/maps/d/viewer?mid=…`) embarque un payload `_pageData` qui, lui,
 *   porte un identifiant par objet. Ces identifiants survivent aux déplacements et aux
 *   renommages, ce qui permet de distinguer une zone déplacée d'une zone supprimée lors d'un
 *   réimport — vérifié sur une carte de test.
 *
 * `_pageData` est un blob interne, non documenté et fait de tableaux positionnels : on ne s'en
 * sert donc que pour l'identité, jamais pour la géométrie. S'il devient illisible, l'import
 * fonctionne encore, en perdant seulement la certitude sur le réimport.
 *
 * Voir `docs/import-carte-google-my-maps.md`.
 */

import { XMLParser } from 'fast-xml-parser'

import { ZONE_LIMITS } from '~~/shared/utils/zone-types'

/** Nature géométrique d'un objet de la carte. */
export type ExternalMapObjectKind = 'polygon' | 'point' | 'line'

export interface ExternalMapObject {
  /** Identifiant chez le fournisseur, `null` si l'appariement a échoué. */
  externalId: string | null
  name: string
  description: string | null
  /** Calque d'origine, qui porte la catégorisation faite par l'organisateur en dessinant. */
  layer: string | null
  kind: ExternalMapObjectKind
  /**
   * Coordonnées au format de l'application : `[latitude, longitude]`.
   * KML écrit `longitude,latitude,altitude` — l'inversion est faite ici, une bonne fois.
   */
  coordinates: [number, number][]
  /** Couleur `#RRGGBB` reprise de la carte, `null` si le style est introuvable. */
  color: string | null
}

export interface ParsedExternalMap {
  name: string | null
  objects: ExternalMapObject[]
}

/**
 * Convertit une couleur KML (`AABBGGRR`, octets inversés et alpha en tête) vers `#RRGGBB`.
 * Sans cette inversion, les couleurs sortent fausses mais crédibles — donc invisibles en relecture.
 */
export function kmlColorToHex(kmlColor: string | undefined | null): string | null {
  const value = String(kmlColor ?? '').trim()
  if (!/^[0-9a-fA-F]{8}$/.test(value)) return null
  const bb = value.slice(2, 4)
  const gg = value.slice(4, 6)
  const rr = value.slice(6, 8)
  return `#${(rr + gg + bb).toUpperCase()}`
}

/** fast-xml-parser rend un objet quand l'élément est unique, un tableau quand il est répété. */
function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'object') {
    const inner = (value as Record<string, unknown>)['#text']
    return inner === undefined ? null : String(inner).trim()
  }
  const s = String(value).trim()
  return s.length ? s : null
}

/**
 * `lon,lat,alt` séparés par des espaces → `[[lat, lon], …]`.
 * Les triplets incomplets ou non numériques sont écartés plutôt que convertis en `NaN`.
 */
function parseCoordinates(raw: unknown): [number, number][] {
  const value = text(raw)
  if (!value) return []
  const out: [number, number][] = []
  for (const triplet of value.split(/\s+/)) {
    const parts = triplet.split(',')
    if (parts.length < 2) continue
    const lon = Number(parts[0])
    const lat = Number(parts[1])
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue
    out.push([lat, lon])
  }
  return out
}

/**
 * Construit la table des styles. Un `styleUrl` de placemark pointe le plus souvent vers un
 * `StyleMap`, qui redirige lui-même vers le style « normal » — d'où la double résolution.
 */
function buildStyleColors(document: Record<string, any>): Map<string, string> {
  const direct = new Map<string, string>()

  for (const style of toArray(document.Style)) {
    const id = style?.['@_id']
    if (!id) continue
    // Le contour est opaque, le remplissage est semi-transparent : les deux portent le même
    // ton, on prend le premier disponible.
    const color =
      kmlColorToHex(text(style?.LineStyle?.color)) ??
      kmlColorToHex(text(style?.PolyStyle?.color)) ??
      kmlColorToHex(text(style?.IconStyle?.color))
    if (color) direct.set(String(id), color)
  }

  const resolved = new Map(direct)
  for (const map of toArray(document.StyleMap)) {
    const id = map?.['@_id']
    if (!id) continue
    const pairs = toArray(map.Pair)
    const normal = pairs.find((p: any) => text(p?.key) === 'normal') ?? pairs[0]
    const target = String(text(normal?.styleUrl) ?? '').replace(/^#/, '')
    const color = direct.get(target)
    if (color) resolved.set(String(id), color)
  }

  return resolved
}

/**
 * Le texte d'une description de placemark, débarrassé de son balisage et borné.
 *
 * ## ⚠️ POURQUOI CE TRAITEMENT EXISTE
 *
 * Deux défauts se cumulaient, et aucun des deux ne se voyait depuis l'écran d'import.
 *
 * **1. Le balisage arrivait tel quel en base.** Google exporte volontiers une description annotée
 * en HTML. Elle s'affichait ensuite ÉCHAPPÉE dans le popup de la carte — l'organisateur y lisait
 * « Accueil&lt;br&gt;Ouvert dès 9 h » au lieu de deux lignes.
 *
 * **2. Un dépassement de longueur faisait refuser l'objet ENTIER**, en 400, et l'écran n'affichait
 * qu'« Impossible d'importer cet objet » : ni la cause, ni la possibilité de tronquer. Une
 * description longue est pourtant la chose la plus ordinaire sur une carte annotée.
 *
 * Tronquer ici plutôt que refuser là-bas est le bon endroit : le parseur est le seul point où la
 * carte du fournisseur rencontre nos contraintes, et c'est ce qui rend l'import des DEUX surfaces
 * — un objet ou un calque entier — tolérant du même coup.
 *
 * ## L'ordre des opérations, qui n'est pas indifférent
 *
 * `balisage → entités → balisage`, et chacune des trois étapes a sa raison :
 *
 * 1. **les balises d'abord**, parce qu'elles arrivent RÉELLES dans les deux formes d'export : en
 *    CDATA le parseur rend le contenu brut, et hors CDATA il décode `&lt;br&gt;` lui-même. Les
 *    deux chemins nous livrent donc un vrai `<br>` ;
 * 2. **les entités ensuite**, pour le `&amp;` d'un « Bar &amp; grill » que le double échappement
 *    laisse passer ;
 * 3. **les balises une seconde fois**, parce que l'étape 2 peut en révéler. Un SECOND passage,
 *    borné, et pas une boucle : le texte vient d'un fichier que nous n'écrivons pas, et une
 *    boucle « tant qu'il reste des balises » sur une entrée qu'on ne contrôle pas se termine mal.
 *
 * ⚠️ ET LA TRONCATURE EN DERNIER, jamais avant le décodage : couper au milieu d'une entité
 * donnerait une fin de texte en « &amp;nb ».
 */
const ENTITES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
}

function sansBalises(valeur: string): string {
  return (
    valeur
      // Les balises de BLOC deviennent des sauts de ligne : les retirer sèchement collerait deux
      // paragraphes en une phrase qui n'a plus de sens.
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p\s*>/gi, '\n')
      .replace(/<p\b[^>]*>/gi, '\n')
      .replace(/<\/div\s*>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n')
      // Tout le reste part sans laisser de trace : une balise `<b>` n'ajoute rien à du texte.
      .replace(/<[^>]*>/g, '')
  )
}

export function descriptionDePlacemark(brut: string | null): string | null {
  if (brut === null) return null

  let texte = sansBalises(brut)
  texte = texte.replace(
    /&(?:nbsp|amp|lt|gt|quot|#39|apos);/gi,
    (e) => ENTITES[e.toLowerCase()] ?? e
  )
  texte = sansBalises(texte)

  texte = texte
    // Trois sauts de ligne ou plus n'apportent rien : les balises de bloc en produisent
    // facilement deux par paragraphe.
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (texte.length === 0) return null
  return texte.length > ZONE_LIMITS.MAX_DESCRIPTION_LENGTH
    ? texte.slice(0, ZONE_LIMITS.MAX_DESCRIPTION_LENGTH)
    : texte
}

function readPlacemark(
  placemark: Record<string, any>,
  layer: string | null,
  styleColors: Map<string, string>
): ExternalMapObject | null {
  let kind: ExternalMapObjectKind
  let coordinates: [number, number][]

  if (placemark.Polygon) {
    kind = 'polygon'
    coordinates = parseCoordinates(
      placemark.Polygon?.outerBoundaryIs?.LinearRing?.coordinates ?? placemark.Polygon?.coordinates
    )
  } else if (placemark.LineString) {
    kind = 'line'
    coordinates = parseCoordinates(placemark.LineString?.coordinates)
  } else if (placemark.Point) {
    kind = 'point'
    coordinates = parseCoordinates(placemark.Point?.coordinates)
  } else {
    return null
  }

  if (coordinates.length === 0) return null

  const styleId = String(text(placemark.styleUrl) ?? '').replace(/^#/, '')

  /*
   * ⚠️ NOM ET DESCRIPTION SONT BORNÉS ICI, aux mêmes longueurs que le schéma du point d'import.
   * Les envoyer tels que lus chez Google faisait refuser l'objet entier en 400 — voir
   * `descriptionDePlacemark` pour ce que ce refus coûtait à l'écran.
   */
  const nom = text(placemark.name) ?? ''

  return {
    externalId: null,
    name:
      nom.length > ZONE_LIMITS.MAX_NAME_LENGTH ? nom.slice(0, ZONE_LIMITS.MAX_NAME_LENGTH) : nom,
    description: descriptionDePlacemark(text(placemark.description)),
    layer,
    kind,
    coordinates,
    color: styleColors.get(styleId) ?? null,
  }
}

/** Analyse l'export KML d'une carte My Maps. */
export function parseGoogleMyMapsKml(xml: string): ParsedExternalMap {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    // Les noms et descriptions sont du texte libre : les laisser tels quels plutôt que de
    // laisser le parseur transformer « 07 » ou « 1.0 » en nombre.
    parseTagValue: false,
    trimValues: true,
  })

  const doc = parser.parse(xml)
  const document = doc?.kml?.Document
  if (!document) return { name: null, objects: [] }

  const styleColors = buildStyleColors(document)
  const objects: ExternalMapObject[] = []

  // Placemarks posés directement sous le document (carte sans calque).
  for (const placemark of toArray(document.Placemark)) {
    const parsed = readPlacemark(placemark, null, styleColors)
    if (parsed) objects.push(parsed)
  }

  for (const folder of toArray(document.Folder)) {
    const layer = text(folder?.name)
    for (const placemark of toArray(folder?.Placemark)) {
      const parsed = readPlacemark(placemark, layer, styleColors)
      if (parsed) objects.push(parsed)
    }
  }

  return { name: text(document.name), objects }
}

/** Un objet tel que le payload du visualiseur le décrit : identifiant et nom, rien de plus. */
export interface ExternalMapFeatureId {
  id: string
  name: string
}

/**
 * Extrait les identifiants du payload `_pageData` de la page du visualiseur.
 *
 * Le format est un tableau positionnel non documenté ; on n'y cherche donc qu'un motif étroit —
 * un identifiant hexadécimal de 16 caractères immédiatement suivi du nom de l'objet — plutôt que
 * de naviguer dans la structure, qui décalerait silencieusement au moindre champ ajouté.
 */
export function parseGoogleMyMapsFeatureIds(html: string): ExternalMapFeatureId[] {
  const match = /_pageData\s*=\s*"(.*?)";/s.exec(html)
  if (!match?.[1]) return []

  let payload: string
  try {
    payload = JSON.parse(`"${match[1]}"`)
  } catch {
    return []
  }

  const features: ExternalMapFeatureId[] = []
  const pattern = /"([0-9A-F]{16})"\],\[\["((?:[^"\\]|\\.)*)"/g
  let found: RegExpExecArray | null
  while ((found = pattern.exec(payload)) !== null) {
    let name = found[2] ?? ''
    try {
      name = JSON.parse(`"${name}"`)
    } catch {
      /* nom laissé tel quel si l'échappement est inattendu */
    }
    // Le payload conserve les espaces et retours à la ligne de fin de saisie, que l'analyse KML
    // supprime. Sans cette normalisation, « Sektor 7 » et « Sektor 7 » ne s'apparient pas.
    features.push({ id: found[1]!, name: name.trim() })
  }
  return features
}

/**
 * Rattache un identifiant à chaque objet du KML.
 *
 * Les deux sources listent les objets dans le même ordre, mais rien ne le garantit dans la durée.
 * On apparie donc d'abord par nom — sûr tant qu'il est unique — et on ne retombe sur l'ordre que
 * pour départager les homonymes entre eux.
 *
 * Si les deux sources ne décrivent pas le même nombre d'objets, on n'apparie rien : mieux vaut un
 * import sans identifiants, qui reste utilisable, qu'un appariement décalé qui rattacherait
 * silencieusement une zone à la mauvaise.
 */
export function attachFeatureIds(
  objects: ExternalMapObject[],
  features: ExternalMapFeatureId[]
): ExternalMapObject[] {
  // Contrat uniforme : la fonction rend toujours des objets dont `externalId` est renseigné,
  // à `null` quand l'appariement n'a pas eu lieu. Renvoyer l'entrée telle quelle laisserait le
  // champ absent, et l'appelant confondrait « pas d'identifiant » et « champ oublié ».
  if (features.length === 0 || features.length !== objects.length) {
    return objects.map((object) => ({ ...object, externalId: null }))
  }

  const byName = new Map<string, string[]>()
  for (const feature of features) {
    const bucket = byName.get(feature.name)
    if (bucket) bucket.push(feature.id)
    else byName.set(feature.name, [feature.id])
  }

  return objects.map((object) => {
    const bucket = byName.get(object.name)
    const id = bucket?.shift() ?? null
    return { ...object, externalId: id }
  })
}
