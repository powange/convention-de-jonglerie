import { describe, it, expect } from 'vitest'

import {
  kmlColorToHex,
  parseGoogleMyMapsKml,
  parseGoogleMyMapsFeatureIds,
  attachFeatureIds,
  descriptionDePlacemark,
} from '../../../server/utils/google-my-maps-import'
import { ZONE_LIMITS } from '../../../shared/utils/zone-types'

const KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>test</name>
    <Style id="poly-06B6D4-2000-102-nodesc-normal">
      <LineStyle><color>ffd4b606</color><width>2</width></LineStyle>
      <PolyStyle><color>66d4b606</color></PolyStyle>
    </Style>
    <StyleMap id="poly-06B6D4-2000-102-nodesc">
      <Pair><key>normal</key><styleUrl>#poly-06B6D4-2000-102-nodesc-normal</styleUrl></Pair>
      <Pair><key>highlight</key><styleUrl>#autre-style</styleUrl></Pair>
    </StyleMap>
    <Folder>
      <name>Zones</name>
      <Placemark>
        <name>Parking voiture</name>
        <styleUrl>#poly-06B6D4-2000-102-nodesc</styleUrl>
        <Polygon><outerBoundaryIs><LinearRing><coordinates>
          0.306323,46.62374,0
          0.306498,46.622746,0
          0.309233,46.622746,0
          0.306323,46.62374,0
        </coordinates></LinearRing></outerBoundaryIs></Polygon>
      </Placemark>
      <Placemark>
        <name>Chemin</name>
        <LineString><coordinates>0.30,46.62,0 0.31,46.63,0</coordinates></LineString>
      </Placemark>
    </Folder>
    <Folder>
      <name>Calque vide</name>
    </Folder>
    <Placemark>
      <name>Accueil</name>
      <description>Sous le chapiteau</description>
      <Point><coordinates>0.307946,46.624514,0</coordinates></Point>
    </Placemark>
  </Document>
</kml>`

describe('kmlColorToHex', () => {
  // KML encode AABBGGRR : sans l'inversion d'octets les couleurs sortent fausses mais crédibles.
  it('inverse les octets et retire le canal alpha', () => {
    expect(kmlColorToHex('ff2bb4af')).toBe('#AFB42B')
    expect(kmlColorToHex('4d000000')).toBe('#000000')
    expect(kmlColorToHex('ffd4b606')).toBe('#06B6D4')
  })

  it('refuse ce qui n’est pas une couleur KML', () => {
    expect(kmlColorToHex('#06B6D4')).toBeNull()
    expect(kmlColorToHex('abc')).toBeNull()
    expect(kmlColorToHex(null)).toBeNull()
    expect(kmlColorToHex(undefined)).toBeNull()
  })
})

describe('parseGoogleMyMapsKml', () => {
  const parsed = parseGoogleMyMapsKml(KML)

  it('lit le nom de la carte', () => {
    expect(parsed.name).toBe('test')
  })

  it('reconnaît les trois natures de géométrie', () => {
    expect(parsed.objects.map((o) => o.kind)).toEqual(['point', 'polygon', 'line'])
  })

  // Le test décisif : KML écrit longitude,latitude — l'application stocke [latitude, longitude].
  // Des coordonnées volontairement dissymétriques (46 vs 0,3) rendent l'inversion visible.
  it('inverse longitude et latitude', () => {
    const polygon = parsed.objects.find((o) => o.name === 'Parking voiture')!
    expect(polygon.coordinates[0]).toEqual([46.62374, 0.306323])
    const point = parsed.objects.find((o) => o.name === 'Accueil')!
    expect(point.coordinates).toEqual([[46.624514, 0.307946]])
  })

  it('résout la couleur à travers le StyleMap vers le style « normal »', () => {
    expect(parsed.objects.find((o) => o.name === 'Parking voiture')!.color).toBe('#06B6D4')
  })

  it('laisse la couleur nulle quand le style est introuvable', () => {
    expect(parsed.objects.find((o) => o.name === 'Chemin')!.color).toBeNull()
  })

  it('rattache chaque objet à son calque, et accepte les objets sans calque', () => {
    expect(parsed.objects.find((o) => o.name === 'Parking voiture')!.layer).toBe('Zones')
    expect(parsed.objects.find((o) => o.name === 'Accueil')!.layer).toBeNull()
  })

  it('lit la description quand elle existe', () => {
    expect(parsed.objects.find((o) => o.name === 'Accueil')!.description).toBe('Sous le chapiteau')
    expect(parsed.objects.find((o) => o.name === 'Chemin')!.description).toBeNull()
  })

  it('ignore un calque vide sans produire d’objet fantôme', () => {
    expect(parsed.objects).toHaveLength(3)
  })

  it('ne rend rien sur une entrée qui n’est pas du KML', () => {
    expect(parseGoogleMyMapsKml('<html></html>')).toEqual({ name: null, objects: [] })
  })
})

describe('parseGoogleMyMapsFeatureIds', () => {
  const html = String.raw`<script>var _pageData = "[[[[15.86,46.42]],\"0\",null,\"X\",[46.41,15.86],[0,0],\"5B7A09F404FD5722\"],[[\"Sektor 7 \"]]],[[[1,2]],\"0\",null,\"Y\",[1,2],[0,0],\"5B7ACE587AEA5E63\"],[[\"Unicycle area\n\"]]]";</script>`

  it('extrait les identifiants et leurs noms', () => {
    expect(parseGoogleMyMapsFeatureIds(html)).toEqual([
      { id: '5B7A09F404FD5722', name: 'Sektor 7' },
      { id: '5B7ACE587AEA5E63', name: 'Unicycle area' },
    ])
  })

  // Le payload conserve les espaces de fin de saisie que le KML supprime : sans normalisation,
  // 4 objets sur 109 restaient non appariés sur une carte réelle.
  it('normalise les espaces de fin, absents côté KML', () => {
    expect(parseGoogleMyMapsFeatureIds(html).map((f) => f.name)).toEqual([
      'Sektor 7',
      'Unicycle area',
    ])
  })

  it('ne rend rien quand le payload est absent ou illisible', () => {
    expect(parseGoogleMyMapsFeatureIds('<html>rien</html>')).toEqual([])
    expect(parseGoogleMyMapsFeatureIds('var _pageData = "\\u";')).toEqual([])
  })
})

describe('attachFeatureIds', () => {
  const objects = [
    { name: 'Toilets' },
    { name: 'Camping' },
    { name: 'Toilets' },
  ] as unknown as Parameters<typeof attachFeatureIds>[0]

  it('apparie par nom, et départage les homonymes dans l’ordre', () => {
    const result = attachFeatureIds(objects, [
      { id: 'AAAA000000000001', name: 'Toilets' },
      { id: 'AAAA000000000002', name: 'Camping' },
      { id: 'AAAA000000000003', name: 'Toilets' },
    ])
    expect(result.map((o) => o.externalId)).toEqual([
      'AAAA000000000001',
      'AAAA000000000002',
      'AAAA000000000003',
    ])
  })

  // Mieux vaut un import sans identifiants, qui reste utilisable, qu'un appariement décalé qui
  // rattacherait silencieusement une zone à la mauvaise.
  it('n’apparie rien si les deux sources ne comptent pas le même nombre d’objets', () => {
    const result = attachFeatureIds(objects, [{ id: 'AAAA000000000001', name: 'Toilets' }])
    expect(result.every((o) => o.externalId === null)).toBe(true)
  })

  it('n’apparie rien quand le payload est vide', () => {
    expect(attachFeatureIds(objects, []).every((o) => o.externalId === null)).toBe(true)
  })
})

/**
 * La description d'un placemark, normalisée.
 *
 * ## Les deux défauts que ces cas ferment
 *
 * **Le balisage arrivait tel quel en base**, et s'affichait ÉCHAPPÉ dans le popup de la carte :
 * l'organisateur lisait « Accueil&lt;br&gt;Ouvert dès 9 h » au lieu de deux lignes.
 *
 * **Un dépassement de longueur faisait refuser l'objet ENTIER**, en 400, et l'écran n'affichait
 * qu'« Impossible d'importer cet objet » : ni la cause, ni la possibilité de tronquer.
 */
describe('descriptionDePlacemark', () => {
  it('rend null pour une absence, et pour un balisage qui ne contenait aucun texte', () => {
    // `<div></div>` n'est pas une description vide « par erreur » : c'est ce que Google produit
    // pour un placemark dont on a effacé la note. L'enregistrer ferait un popup avec une section
    // vide.
    expect(descriptionDePlacemark(null)).toBeNull()
    expect(descriptionDePlacemark('<div></div>')).toBeNull()
    expect(descriptionDePlacemark('   ')).toBeNull()
  })

  it('remplace les balises de bloc par des sauts de ligne', () => {
    // Les retirer sèchement collerait deux paragraphes en une phrase qui n'a plus de sens.
    expect(descriptionDePlacemark('Accueil<br>Ouvert dès 9 h')).toBe('Accueil\nOuvert dès 9 h')
    /*
     * 📍 DEUX sauts pour deux paragraphes, et c'est voulu : `</p>` ferme le premier, `<p>` ouvre
     * le second. Un paragraphe se sépare du suivant par une ligne vide — c'est ce que l'auteur a
     * écrit dans Google, et l'aplatir sur un seul saut rendrait sa note moins lisible que son
     * original. Ma première attente disait l'inverse ; c'est elle qui avait tort.
     */
    expect(descriptionDePlacemark('<p>Un</p><p>Deux</p>')).toBe('Un\n\nDeux')
  })

  it('retire les autres balises sans laisser de trace', () => {
    expect(descriptionDePlacemark('Le <b>grand</b> chapiteau')).toBe('Le grand chapiteau')
  })

  it('décode les entités courantes', () => {
    expect(descriptionDePlacemark('Bar &amp; grill')).toBe('Bar & grill')
    expect(descriptionDePlacemark('Tarif&nbsp;: 5&nbsp;€')).toBe('Tarif : 5 €')
  })

  it('retire aussi les balises révélées par le décodage', () => {
    /*
     * ⚠️ LE SECOND PASSAGE. Un export doublement échappé livre `&lt;br&gt;` : le premier balayage
     * de balises ne voit rien, et c'est le décodage qui fait apparaître le `<br>`. Sans ce second
     * passage, la balise serait enregistrée telle quelle — exactement le défaut qu'on répare.
     */
    expect(descriptionDePlacemark('Accueil&lt;br&gt;Ouvert')).toBe('Accueil\nOuvert')
    expect(descriptionDePlacemark('Un &lt;b&gt;mot&lt;/b&gt;')).toBe('Un mot')
  })

  it('tronque à la limite partagée avec le schéma du point d’import', () => {
    // La limite est lue dans ZONE_LIMITS et non recopiée : c'est tout l'objet du lot que les deux
    // endroits ne puissent plus diverger.
    const long = 'a'.repeat(ZONE_LIMITS.MAX_DESCRIPTION_LENGTH + 500)
    expect(descriptionDePlacemark(long)).toHaveLength(ZONE_LIMITS.MAX_DESCRIPTION_LENGTH)
  })

  it('tronque APRÈS le décodage, jamais avant', () => {
    /*
     * ⚠️ L'ORDRE COMPTE. Couper d'abord laisserait une fin de texte en « &nb », et le texte
     * tronqué ne vaudrait pas la limite : une entité de six caractères n'en vaut qu'un une fois
     * décodée. Ce cas mesure donc que la troncature s'applique au texte FINAL.
     */
    const brut = '&amp;'.repeat(ZONE_LIMITS.MAX_DESCRIPTION_LENGTH)
    const sortie = descriptionDePlacemark(brut)!
    expect(sortie).toHaveLength(ZONE_LIMITS.MAX_DESCRIPTION_LENGTH)
    expect(sortie).not.toContain('&amp;')
    expect(sortie.startsWith('&&&')).toBe(true)
  })

  it('réduit les sauts de ligne en excès, que les balises de bloc produisent facilement', () => {
    expect(descriptionDePlacemark('<p>Un</p><br><br><br><p>Deux</p>')).toBe('Un\n\nDeux')
  })
})

/**
 * Le placemark lui-même, borné.
 *
 * ⚠️ Ces deux cas sont le POINT DE JONCTION avec le défaut : le parseur rendait nom et description
 * tels que lus chez Google, alors que le schéma du point d'import les borne. C'est ce désaccord qui
 * faisait répondre 400 — et l'écran n'en disait pas la cause.
 */
describe('readPlacemark : les longueurs du schéma sont respectées à la lecture', () => {
  const kmlAvec = (nom: string, description: string) => `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Carte</name>
    <Placemark>
      <name>${nom}</name>
      <description>${description}</description>
      <Point><coordinates>2.35,48.85,0</coordinates></Point>
    </Placemark>
  </Document>
</kml>`

  it('tronque un nom trop long au lieu de le laisser faire refuser l’objet', () => {
    const { objects } = parseGoogleMyMapsKml(kmlAvec('N'.repeat(300), 'ok'))
    expect(objects).toHaveLength(1)
    expect(objects[0]!.name).toHaveLength(ZONE_LIMITS.MAX_NAME_LENGTH)
  })

  it('normalise la description du placemark, balises comprises', () => {
    const { objects } = parseGoogleMyMapsKml(kmlAvec('Accueil', 'Ligne 1&lt;br&gt;Ligne 2'))
    expect(objects[0]!.description).toBe('Ligne 1\nLigne 2')
  })
})
