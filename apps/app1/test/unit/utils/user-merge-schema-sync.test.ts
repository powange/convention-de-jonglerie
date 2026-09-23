import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

import { USER_REFERENCES } from '../../../server/utils/user-merge-references'

/**
 * La fusion de comptes repose entièrement sur `USER_REFERENCES` : une relation vers `User`
 * oubliée laisse des lignes rattachées au compte absorbé, et sa suppression échoue alors sur
 * une contrainte de clé étrangère — en production, au milieu d'une transaction.
 *
 * Ce test relit `prisma/schema/*.prisma` et refuse tout écart, pour que l'oubli soit signalé
 * ici plutôt que découvert par un administrateur.
 */

const SCHEMA_DIR = join(process.cwd(), 'prisma', 'schema')

/** `EditionVolunteerApplication` → `editionVolunteerApplication` (nom du delegate Prisma). */
function toDelegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1)
}

interface SchemaRelation {
  model: string
  field: string
}

/** Relève les `@relation(fields: [x], references: [id])` pointant vers `User`. */
function collectUserRelations(): SchemaRelation[] {
  const relations: SchemaRelation[] = []

  for (const file of readdirSync(SCHEMA_DIR).filter((f) => f.endsWith('.prisma'))) {
    const content = readFileSync(join(SCHEMA_DIR, file), 'utf8')
    let currentModel: string | null = null

    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim()

      const modelStart = line.match(/^model\s+(\w+)\s*\{/)
      if (modelStart) {
        currentModel = modelStart[1]!
        continue
      }
      if (line === '}') {
        currentModel = null
        continue
      }
      if (!currentModel || currentModel === 'User') continue

      // ex. `user User? @relation("X", fields: [userId], references: [id], onDelete: Cascade)`
      const relation = line.match(/^\w+\s+User\??\s+@relation\(.*?fields:\s*\[(\w+)\]/)
      if (relation) {
        relations.push({ model: toDelegateName(currentModel), field: relation[1]! })
      }
    }
  }

  return relations
}

/**
 * Les colonnes entières d'apparence « identifiant » que NULLE relation Prisma ne rattache.
 *
 * C'est l'angle mort de ce test : une colonne qui porte un `User.id` sans clé étrangère ne
 * casse rien quand on la laisse pendante — la suppression du compte absorbé réussit, et
 * l'identifiant orphelin se lit ensuite comme une valeur plausible. C'est ainsi que
 * `ticketingOrderItem.entryValidatedBy` a manqué à l'inventaire alors que ses trois jumelles y
 * figuraient.
 *
 * Toute colonne relevée ici doit donc être SOIT déclarée dans `USER_REFERENCES`, SOIT inscrite
 * ci-dessous comme ne désignant pas un utilisateur. Le choix est explicite dans les deux cas.
 */
function collectUnrelatedIdColumns(): SchemaRelation[] {
  const colonnes: SchemaRelation[] = []

  for (const file of readdirSync(SCHEMA_DIR).filter((f) => f.endsWith('.prisma'))) {
    const content = readFileSync(join(SCHEMA_DIR, file), 'utf8')

    for (const bloc of content.split(/^model\s+/m).slice(1)) {
      const nom = bloc.match(/^(\w+)/)?.[1]
      if (!nom || nom === 'User') continue
      const corps = bloc.slice(0, bloc.indexOf('\n}'))

      // Les colonnes déjà portées par une relation — vers User ou vers autre chose.
      const liees = new Set<string>()
      for (const rel of corps.matchAll(/@relation\([^)]*fields:\s*\[([^\]]+)\]/g)) {
        for (const champ of rel[1]!.split(',')) liees.add(champ.trim())
      }

      for (const rawLine of corps.split('\n')) {
        const line = rawLine.split('//')[0]!.trimEnd()
        const champ = line.match(/^\s+(\w+)\s+Int\??\s*$/)?.[1]
        if (!champ || champ === 'id' || liees.has(champ)) continue
        if (!/(Id|By)$/.test(champ)) continue
        colonnes.push({ model: toDelegateName(nom), field: champ })
      }
    }
  }

  return colonnes
}

/**
 * Les colonnes d'identifiant qui ne désignent PAS un utilisateur, et n'ont donc rien à faire
 * dans une fusion de comptes. Vérifiées une à une :
 *
 * - les `helloAsso*` et `infomaniakConfig.eventId` portent des identifiants de services tiers ;
 * - `entryValidationLog.participantId` va de pair avec `participantKind` : il désigne l'entité
 *   validée — billet, bénévole, artiste — et non la personne qui a validé, laquelle est
 *   `actorId`, dûment déclarée.
 */
const COLONNES_SANS_RAPPORT_AVEC_UN_UTILISATEUR = new Set([
  'entryValidationLog.participantId',
  'infomaniakConfig.eventId',
  'ticketingOrder.helloAssoOrderId',
  'ticketingOrderItem.helloAssoItemId',
  'ticketingTier.helloAssoTierId',
  'ticketingTierCustomField.helloAssoCustomFieldId',
])

describe('USER_REFERENCES vs schéma Prisma', () => {
  const schemaRelations = collectUserRelations()
  const declared = new Set(USER_REFERENCES.map((ref) => `${ref.model}.${ref.field}`))

  it('relève bien des relations vers User dans le schéma', () => {
    // Garde-fou : si le parsing casse, les assertions suivantes deviendraient vides et
    // passeraient sans rien vérifier.
    expect(schemaRelations.length).toBeGreaterThan(30)
  })

  it('déclare chaque relation vers User du schéma', () => {
    const missing = schemaRelations
      .map((rel) => `${rel.model}.${rel.field}`)
      .filter((key) => !declared.has(key))

    expect(
      missing,
      `Relations vers User absentes de USER_REFERENCES (server/utils/user-merge-references.ts) : ${missing.join(', ')}`
    ).toEqual([])
  })

  /*
   * Le test qui manquait : sans lui, une colonne « molle » oubliée ne se voit nulle part —
   * ni ici, ni à l'exécution, puisque aucune clé étrangère ne proteste.
   */
  it('range chaque colonne d’identifiant sans relation : déclarée, ou écartée explicitement', () => {
    const colonnes = collectUnrelatedIdColumns()

    // Garde-fou : si le parsing casse, l'assertion suivante passerait sur une liste vide.
    expect(colonnes.length).toBeGreaterThan(5)

    const orphelines = colonnes
      .map((c) => `${c.model}.${c.field}`)
      .filter((cle) => !declared.has(cle) && !COLONNES_SANS_RAPPORT_AVEC_UN_UTILISATEUR.has(cle))

    expect(
      orphelines,
      `Colonnes d'identifiant sans relation Prisma qu'il faut trancher : soit les déclarer dans USER_REFERENCES (avec soft: true), soit les inscrire dans COLONNES_SANS_RAPPORT_AVEC_UN_UTILISATEUR. ${orphelines.join(', ')}`
    ).toEqual([])
  })

  it('ne déclare aucune relation qui n’existe plus, hors références « molles »', () => {
    const inSchema = new Set(schemaRelations.map((rel) => `${rel.model}.${rel.field}`))
    const stale = USER_REFERENCES.filter(
      (ref) => !ref.soft && !inSchema.has(`${ref.model}.${ref.field}`)
    ).map((ref) => `${ref.model}.${ref.field}`)

    expect(
      stale,
      `Entrées de USER_REFERENCES sans relation correspondante dans le schéma : ${stale.join(', ')}`
    ).toEqual([])
  })
})
