import { describe, it, expect } from 'vitest'

import {
  looksLikeFetchIncident,
  reconcileExternalMap,
  type ImportedRecord,
} from '../../../server/utils/external-map-reconcile'
import type { ExternalMapObject } from '../../../server/utils/google-my-maps-import'

const IMPORTED_AT = new Date('2026-07-01T10:00:00Z')

function object(
  externalId: string | null,
  name: string,
  kind: ExternalMapObject['kind'] = 'polygon'
) {
  return {
    externalId,
    name,
    description: null,
    layer: 'Zones',
    kind,
    coordinates: [[46.4, 15.8]],
    color: '#06B6D4',
  } as ExternalMapObject
}

function record(
  id: number,
  externalMapObjectId: string | null,
  updatedAt = IMPORTED_AT
): ImportedRecord {
  return {
    id,
    name: `objet ${id}`,
    externalMapObjectId,
    externalMapImportedAt: externalMapObjectId ? IMPORTED_AT : null,
    updatedAt,
    dependencies: { shows: 0, workshops: 0, stockItems: 0, stockReservations: 0 },
  }
}

describe('reconcileExternalMap', () => {
  it('classe un objet absent de la base comme importable', () => {
    const rows = reconcileExternalMap([object('AAA1', 'Camping')], [], [])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.state).toBe('importable')
  })

  it('reconnaît un objet déjà importé par son identifiant', () => {
    const rows = reconcileExternalMap(
      [object('AAA1', 'Camping')],
      [{ ...record(1, 'AAA1'), kind: 'zone' as const }],
      []
    )
    expect(rows[0]!.state).toBe('imported')
    expect(rows[0]!.record?.id).toBe(1)
  })

  // L'identifiant survit aux déplacements et aux renommages : c'est tout l'intérêt de s'en servir
  // plutôt que du nom, qui changerait.
  it('suit un objet renommé sans le prendre pour un nouvel objet', () => {
    const rows = reconcileExternalMap(
      [object('AAA1', 'Nouveau nom')],
      [{ ...record(1, 'AAA1'), kind: 'zone' as const }],
      []
    )
    expect(rows.map((r) => r.state)).toEqual(['imported'])
  })

  it('signale un objet qui n’est plus sur la carte', () => {
    const rows = reconcileExternalMap([], [{ ...record(1, 'AAA1'), kind: 'zone' as const }], [])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.state).toBe('missing')
    expect(rows[0]!.record?.id).toBe(1)
  })

  // Une zone dessinée à la main n'a jamais eu de contrepartie sur la carte externe : elle ne peut
  // donc pas en avoir disparu, et ne doit jamais être proposée à la suppression.
  it('ignore les objets créés à la main', () => {
    const rows = reconcileExternalMap([], [{ ...record(1, null), kind: 'zone' as const }], [])
    expect(rows).toEqual([])
  })

  // Zones et marqueurs numérotent leurs identifiants séparément : sans clé composite, la zone 5
  // masquerait le marqueur 5, et un marqueur réellement disparu ne serait jamais signalé.
  it('ne confond pas une zone et un marqueur de même identifiant', () => {
    const rows = reconcileExternalMap(
      [object('ZONE1', 'Camping')],
      [{ ...record(5, 'ZONE1'), kind: 'zone' as const }],
      [{ ...record(5, 'MARK1'), kind: 'marker' as const }]
    )
    const states = rows.map((r) => `${r.state}:${r.record?.kind ?? '-'}`)
    expect(states).toContain('imported:zone')
    expect(states).toContain('missing:marker')
  })

  it('marque les tracés comme non compatibles sans les convertir', () => {
    const rows = reconcileExternalMap([object('AAA1', 'Chemin', 'line')], [], [])
    expect(rows[0]!.state).toBe('unsupported')
  })

  it('repère un objet retouché dans l’application depuis son import', () => {
    const later = new Date(IMPORTED_AT.getTime() + 60_000)
    const rows = reconcileExternalMap(
      [object('AAA1', 'Camping')],
      [{ ...record(1, 'AAA1', later), kind: 'zone' as const }],
      []
    )
    expect(rows[0]!.editedLocally).toBe(true)
  })

  it('ne prend pas l’écriture d’import elle-même pour une retouche', () => {
    const rows = reconcileExternalMap(
      [object('AAA1', 'Camping')],
      [{ ...record(1, 'AAA1', new Date(IMPORTED_AT.getTime() + 200)), kind: 'zone' as const }],
      []
    )
    expect(rows[0]!.editedLocally).toBe(false)
  })

  // Sans identifiant côté carte, on ne peut rien rapprocher : tout est proposé à l'import, et rien
  // n'est déclaré disparu — mieux vaut un doublon qu'une suppression à tort.
  it('ne déclare rien disparu quand les identifiants manquent', () => {
    const rows = reconcileExternalMap(
      [object(null, 'Camping')],
      [{ ...record(1, 'AAA1'), kind: 'zone' as const }],
      []
    )
    expect(rows.map((r) => r.state).sort()).toEqual(['importable', 'missing'])
  })
})

describe('looksLikeFetchIncident', () => {
  // Une carte repassée en privé ou un incident réseau renvoie zéro objet : proposer alors de tout
  // supprimer détruirait le travail de l'organisateur.
  it('considère une carte vide comme un incident quand des objets en proviennent', () => {
    expect(looksLikeFetchIncident(0, 42)).toBe(true)
  })

  it('accepte une carte vide quand rien n’en a jamais été importé', () => {
    expect(looksLikeFetchIncident(0, 0)).toBe(false)
  })

  it('n’alerte pas quand la carte renvoie des objets', () => {
    expect(looksLikeFetchIncident(42, 42)).toBe(false)
  })
})
