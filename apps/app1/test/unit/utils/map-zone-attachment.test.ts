import { describe, expect, it } from 'vitest'

import type { GroupableLegendItem } from '../../../app/utils/map-zone-attachment'
import {
  buildItemsPopupHtml,
  buildMarkerAttachmentHtml,
  buildZoneAttachmentHtml,
  filterLegendGroups,
  fromZoneSelection,
  groupLegendItems,
  NO_ZONE,
  toZoneSelection,
  groupMarkersByZone,
  zoneNavigationTarget,
} from '../../../app/utils/map-zone-attachment'

const marker = (over: Partial<Parameters<typeof groupMarkersByZone>[0][number]> = {}) => ({
  id: 1,
  name: 'Entrée principale',
  latitude: 47.1,
  longitude: -1.5,
  zoneId: null as number | null,
  ...over,
})

describe('groupMarkersByZone', () => {
  it('regroupe par zone et écarte les marqueurs autonomes', () => {
    const result = groupMarkersByZone([
      marker({ id: 1, zoneId: 10 }),
      marker({ id: 2, zoneId: 10 }),
      marker({ id: 3, zoneId: 20 }),
      marker({ id: 4, zoneId: null }),
    ])

    expect([...result.keys()].sort()).toEqual([10, 20])
    expect(result.get(10)!.map((m) => m.id)).toEqual([1, 2])
    expect(result.get(20)!.map((m) => m.id)).toEqual([3])
  })

  // `zoneId` absent du payload et `zoneId: null` veulent dire la même chose côté affichage.
  it('traite un rattachement absent comme une absence de rattachement', () => {
    const result = groupMarkersByZone([{ ...marker(), zoneId: undefined as never }])
    expect(result.size).toBe(0)
  })
})

describe('zoneNavigationTarget', () => {
  it('vise la première entrée selon l’ordre choisi par l’organisateur', () => {
    const target = zoneNavigationTarget([
      { ...marker({ id: 2, zoneId: 10 }), latitude: 1, longitude: 2, order: 5 },
      { ...marker({ id: 1, zoneId: 10 }), latitude: 3, longitude: 4, order: 1 },
    ])
    expect(target).toEqual([3, 4])
  })

  // Sans entrée, le centre calculé du polygone reste la seule destination possible.
  it('rend null quand la zone n’a aucune entrée', () => {
    expect(zoneNavigationTarget([])).toBeNull()
    expect(zoneNavigationTarget(undefined)).toBeNull()
  })

  it('ne modifie pas le tableau reçu', () => {
    const attached = [
      { ...marker({ id: 2, zoneId: 10 }), order: 5 },
      { ...marker({ id: 1, zoneId: 10 }), order: 1 },
    ]
    zoneNavigationTarget(attached)
    expect(attached.map((m) => m.id)).toEqual([2, 1])
  })
})

describe('construction des popups', () => {
  it('liste les entrées d’une zone', () => {
    const html = buildZoneAttachmentHtml(
      [marker({ id: 1, name: 'Entrée principale' }), marker({ id: 2, name: 'Accès PMR' })],
      'Entrées :'
    )
    expect(html).toContain('Entrée principale, Accès PMR')
  })

  it('reste vide sans rattachement, pour ne pas afficher un libellé orphelin', () => {
    expect(buildZoneAttachmentHtml([], 'Entrées :')).toBe('')
    expect(buildMarkerAttachmentHtml(undefined, 'Entrée de :')).toBe('')
  })

  // Le nom vient de l'organisateur et atterrit dans du HTML construit à la main.
  it('échappe les noms', () => {
    const html = buildMarkerAttachmentHtml('<img src=x onerror=alert(1)>', 'Entrée de :')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')

    const zoneHtml = buildZoneAttachmentHtml([marker({ name: '<script>' })], 'Entrées :')
    expect(zoneHtml).not.toContain('<script>')
  })
})

const legendItem = (over: Partial<GroupableLegendItem> = {}): GroupableLegendItem => ({
  id: 1,
  name: 'Salle A',
  types: ['OTHER'],
  itemType: 'zone',
  zoneId: null,
  ...over,
})

describe('groupLegendItems', () => {
  it('range les entrées sous leur zone, la zone en tête', () => {
    const groups = groupLegendItems([
      legendItem({ id: 1, name: 'Salle A', itemType: 'zone' }),
      legendItem({ id: 9, name: 'Entrée principale', itemType: 'marker', zoneId: 1 }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]!.rows.map((r) => r.name)).toEqual(['Salle A', 'Entrée principale'])
  })

  // Une entrée listée à la fois sous sa zone et à la racine se dupliquerait à l'écran.
  it('n’affiche jamais une entrée deux fois', () => {
    const groups = groupLegendItems([
      legendItem({ id: 1, itemType: 'zone' }),
      legendItem({ id: 9, name: 'Entrée', itemType: 'marker', zoneId: 1 }),
    ])

    const names = groups.flatMap((g) => g.rows.map((r) => r.name))
    expect(names.filter((n) => n === 'Entrée')).toHaveLength(1)
  })

  // Le rattachement pourrait pointer une zone absente de la liste : la faire disparaître
  // silencieusement priverait l'organisateur du seul moyen de la corriger.
  it('remonte une entrée dont la zone est absente', () => {
    const groups = groupLegendItems([
      legendItem({ id: 9, name: 'Entrée orpheline', itemType: 'marker', zoneId: 404 }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]!.rows.map((r) => r.name)).toEqual(['Entrée orpheline'])
  })

  it('laisse les marqueurs autonomes seuls dans leur groupe', () => {
    const groups = groupLegendItems([
      legendItem({ id: 1, name: 'Salle A', itemType: 'zone' }),
      legendItem({ id: 9, name: 'Buvette', itemType: 'marker', zoneId: null }),
    ])

    expect(groups.map((g) => g.rows.length)).toEqual([1, 1])
  })

  it('trie les groupes par nom', () => {
    const groups = groupLegendItems([
      legendItem({ id: 1, name: 'Zone B', itemType: 'zone' }),
      legendItem({ id: 2, name: 'Accueil', itemType: 'zone' }),
    ])

    expect(groups.map((g) => g.name)).toEqual(['Accueil', 'Zone B'])
  })
})

describe('filterLegendGroups', () => {
  const groups = () =>
    groupLegendItems([
      legendItem({ id: 1, name: 'Salle A', itemType: 'zone', types: ['FOOD'] }),
      legendItem({ id: 9, name: 'Entrée', itemType: 'marker', zoneId: 1, types: ['ENTRANCE'] }),
      legendItem({ id: 2, name: 'Camping', itemType: 'zone', types: ['CAMPING'] }),
    ])

  // Trois éléments, mais deux groupes : l'entrée vit sous sa zone.
  it('sans filtre, rend tous les groupes', () => {
    const result = filterLegendGroups(groups(), new Set())
    expect(result.map((g) => g.name)).toEqual(['Camping', 'Salle A'])
    expect(result.flatMap((g) => g.rows)).toHaveLength(3)
  })

  // Le groupe est l'unité : filtrer ligne à ligne détacherait ce qu'on vient de regrouper.
  it('retient la zone entière quand la zone correspond', () => {
    const result = filterLegendGroups(groups(), new Set(['FOOD']))
    expect(result).toHaveLength(1)
    expect(result[0]!.rows.map((r) => r.name)).toEqual(['Salle A', 'Entrée'])
  })

  it('fait apparaître la zone quand seule son entrée correspond', () => {
    const result = filterLegendGroups(groups(), new Set(['ENTRANCE']))
    expect(result).toHaveLength(1)
    expect(result[0]!.rows.map((r) => r.name)).toEqual(['Salle A', 'Entrée'])
  })
})

/**
 * Le sélecteur ne peut pas porter `null` : Nuxt UI le lit comme « rien de sélectionné ». Le
 * choix « aucune zone » existait donc dans la liste sans jamais pouvoir être retenu, et un
 * rattachement une fois posé ne se retirait plus.
 */
describe('valeur du sélecteur de zone', () => {
  it('représente l’absence de rattachement par une valeur choisissable', () => {
    expect(toZoneSelection(null)).toBe(NO_ZONE)
    expect(toZoneSelection(undefined)).toBe(NO_ZONE)
    expect(NO_ZONE).not.toBeNull()
  })

  it('conserve un rattachement existant', () => {
    expect(toZoneSelection(42)).toBe(42)
  })

  it('retraduit le choix « aucune zone » en détachement', () => {
    expect(fromZoneSelection(NO_ZONE)).toBeNull()
    expect(fromZoneSelection(null)).toBeNull()
    expect(fromZoneSelection(undefined)).toBeNull()
  })

  it('retraduit une zone choisie en son identifiant', () => {
    expect(fromZoneSelection(42)).toBe(42)
  })

  // La conversion doit faire l'aller-retour sans rien perdre, dans les deux sens.
  it('fait l’aller-retour', () => {
    for (const zoneId of [null, 1, 42]) {
      expect(fromZoneSelection(toZoneSelection(zoneId))).toBe(zoneId)
    }
  })
})

/**
 * Les TROIS sources dans le popup d'un lieu.
 *
 * ⚠️ Le défaut corrigé : les popups listaient les spectacles et les ateliers, mais pas les
 * ÉLÉMENTS LIBRES du programme — un repas, une scène ouverte, l'ouverture de l'accueil. Ils se
 * rattachent pourtant à une zone ou à un repère exactement comme les deux autres sources.
 *
 * 📍 Ces tests existent aussi parce que cette mise en forme vivait dans `map.vue`, où elle était
 * intestable. Les popups de cet écran ont connu deux défauts MUETS — un point d'API non public,
 * une clé de réponse renommée — qui se lisaient tous deux « popup sans spectacle, sans erreur ».
 */
describe('buildItemsPopupHtml — les trois sources', () => {
  const libelles = {
    titreDeSource: (source: string) =>
      ({ spectacle: 'Spectacle', workshop: 'Workshop', element: 'Programme' })[source] ?? source,
    formaterHorodatage: (h: string) => `[${h}]`,
  }

  const entree = (over: Partial<Parameters<typeof buildItemsPopupHtml>[0][number]> = {}) => ({
    titre: 'Jonglerie libre',
    debut: '2026-07-01T14:00:00.000Z',
    source: 'element',
    ...over,
  })

  it('montre un ÉLÉMENT LIBRE du programme — ce que les popups omettaient', () => {
    const html = buildItemsPopupHtml([entree({ titre: 'Repas du soir' })], libelles)

    expect(html).toContain('Repas du soir')
    expect(html).toContain('Programme')
    expect(html).toContain('📋')
  })

  it('montre les trois sources, chacune sous son titre', () => {
    const html = buildItemsPopupHtml(
      [
        entree({ titre: 'Gala', source: 'spectacle', duree: 90 }),
        entree({ titre: 'Massues', source: 'workshop' }),
        entree({ titre: 'Scène ouverte', source: 'element' }),
      ],
      libelles
    )

    for (const attendu of ['Gala', 'Massues', 'Scène ouverte', '🎭', '🎓', '📋']) {
      expect(html, `« ${attendu} » absent du popup`).toContain(attendu)
    }
    // L'ordre des sections est celui de la frise : spectacle, atelier, élément.
    expect(html.indexOf('Gala')).toBeLessThan(html.indexOf('Massues'))
    expect(html.indexOf('Massues')).toBeLessThan(html.indexOf('Scène ouverte'))
  })

  it('n’ouvre une section que si elle a des entrées', () => {
    // Sans cette règle, un lieu qui n'accueille qu'un atelier afficherait trois titres vides.
    const html = buildItemsPopupHtml([entree({ source: 'workshop' })], libelles)

    expect(html).toContain('Workshop')
    expect(html).not.toContain('Spectacle')
    expect(html).not.toContain('Programme')
  })

  it('trie par heure DANS chaque section', () => {
    const html = buildItemsPopupHtml(
      [
        entree({ titre: 'Tard', debut: '2026-07-01T20:00:00.000Z' }),
        entree({ titre: 'Tôt', debut: '2026-07-01T09:00:00.000Z' }),
      ],
      libelles
    )

    expect(html.indexOf('Tôt')).toBeLessThan(html.indexOf('Tard'))
  })

  it('n’affiche la durée que quand il y en a une', () => {
    expect(buildItemsPopupHtml([entree({ duree: 90 })], libelles)).toContain('(90 min)')
    expect(buildItemsPopupHtml([entree({ duree: null })], libelles)).not.toContain('min)')
    expect(buildItemsPopupHtml([entree()], libelles)).not.toContain('min)')
  })

  it('échappe le titre, qui vient de l’organisateur et atterrit dans du HTML', () => {
    const html = buildItemsPopupHtml([entree({ titre: '<img src=x onerror=alert(1)>' })], libelles)

    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })

  it('rend une chaîne vide sans entrée, pour ne pas poser un séparateur orphelin', () => {
    expect(buildItemsPopupHtml([], libelles)).toBe('')
  })
})
