/**
 * Rapprochement entre la carte externe d'une édition et ce qui a déjà été importé en base.
 *
 * Trois états sont possibles pour un objet, et le troisième est le plus délicat :
 *
 * - présent sur la carte, absent en base → à importer ;
 * - présent des deux côtés → déjà importé, éventuellement modifié depuis ;
 * - présent en base, plus retrouvé sur la carte → probablement supprimé chez le fournisseur.
 *
 * Le troisième état ne déclenche jamais de suppression automatique. Voir
 * `docs/import-carte-google-my-maps.md`.
 */

import type { ExternalMapObject } from './google-my-maps-import'

/** Objet déjà importé, tel que la base le connaît. */
export interface ImportedRecord {
  id: number
  name: string
  /** Couleur enregistrée, pour repérer une modification depuis l'import. */
  color: string | null
  /** Catégories enregistrées, même usage. */
  types: string[]
  externalMapObjectId: string | null
  externalMapImportedAt: Date | null
  updatedAt: Date
  /** Ce qui perdrait son lieu si on supprimait cet objet. */
  dependencies: { shows: number; workshops: number; stockItems: number; stockReservations: number }
}

export type ReconciledState = 'importable' | 'imported' | 'missing' | 'unsupported'

export interface ReconciledRow {
  state: ReconciledState
  /** Renseigné pour `importable`, `imported` et `unsupported`. */
  object?: ExternalMapObject
  /** Renseigné pour `imported` et `missing`. */
  record?: ImportedRecord & { kind: 'zone' | 'marker' }
  /** Vrai quand l'objet a été retouché dans l'application depuis son import. */
  editedLocally?: boolean
}

/** Une modification postérieure de plus d'une seconde est une retouche, pas l'écriture d'import. */
const LOCAL_EDIT_TOLERANCE_MS = 1_000

function isEditedLocally(record: ImportedRecord): boolean {
  if (!record.externalMapImportedAt) return false
  return (
    record.updatedAt.getTime() - record.externalMapImportedAt.getTime() > LOCAL_EDIT_TOLERANCE_MS
  )
}

/**
 * Croise les objets de la carte et les enregistrements importés.
 *
 * L'appariement se fait sur l'identifiant du fournisseur quand il est disponible — il survit aux
 * déplacements et aux renommages, ce qui distingue un objet déplacé d'un objet supprimé.
 */
export function reconcileExternalMap(
  objects: ExternalMapObject[],
  zones: (ImportedRecord & { kind: 'zone' })[],
  markers: (ImportedRecord & { kind: 'marker' })[]
): ReconciledRow[] {
  const records = [...zones, ...markers]
  const byExternalId = new Map<string, (typeof records)[number]>()
  for (const record of records) {
    if (record.externalMapObjectId) byExternalId.set(record.externalMapObjectId, record)
  }

  // Zones et marqueurs numérotent leurs identifiants séparément : la zone 5 et le marqueur 5
  // coexistent. La clé doit donc inclure la nature, faute de quoi l'une masquerait l'autre et un
  // marqueur réellement disparu ne serait jamais signalé.
  const recordKey = (record: (typeof records)[number]) => `${record.kind}-${record.id}`
  const matched = new Set<string>()
  const rows: ReconciledRow[] = []

  for (const object of objects) {
    // Un tracé n'a pas d'équivalent dans le modèle : on l'annonce plutôt que de le convertir de
    // force en polygone ou de le faire disparaître sans un mot.
    if (object.kind === 'line') {
      rows.push({ state: 'unsupported', object })
      continue
    }

    const record = object.externalId ? byExternalId.get(object.externalId) : undefined
    if (record) {
      matched.add(recordKey(record))
      rows.push({
        state: 'imported',
        object,
        record,
        editedLocally: isEditedLocally(record),
      })
    } else {
      rows.push({ state: 'importable', object })
    }
  }

  for (const record of records) {
    // Seuls les objets issus d'un import sont concernés : une zone dessinée à la main n'a jamais
    // eu de contrepartie sur la carte externe et n'a donc pas pu en disparaître.
    if (!record.externalMapObjectId || matched.has(recordKey(record))) continue
    rows.push({ state: 'missing', record, editedLocally: isEditedLocally(record) })
  }

  return rows
}

/**
 * Une disparition massive est un incident de récupération, pas une intention.
 *
 * Si la carte revient vide alors que des objets en proviennent, proposer leur suppression
 * détruirait le travail de l'organisateur sur un simple incident réseau ou un passage en privé.
 */
export function looksLikeFetchIncident(objectCount: number, importedCount: number): boolean {
  return importedCount > 0 && objectCount === 0
}
