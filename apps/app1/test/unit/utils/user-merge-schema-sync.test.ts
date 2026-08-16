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
