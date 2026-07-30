import { describe, expect, it } from 'vitest'

import {
  buildMarkerAttachmentHtml,
  buildZoneAttachmentHtml,
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
