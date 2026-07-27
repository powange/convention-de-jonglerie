import fs from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

import { CONVENTION_RIGHTS, EDITION_RIGHTS } from '../../../shared/utils/organizer-rights'

/**
 * Garde-fou contre la dérive des droits d'organisateur.
 *
 * Les droits étaient recopiés à la main dans les types, le formulaire, le store, le menu et le
 * guide. Rien ne reliait ces copies : quand Workshops, FAQ, Tâches et Stock ont été ajoutés au
 * schéma, plusieurs sont restées en arrière, et le guide a longtemps documenté deux droits qui
 * n'ont jamais existé.
 *
 * shared/utils/organizer-rights est désormais la source unique. Ce test vérifie qu'elle
 * correspond au schéma Prisma, et que le guide fournit un libellé pour chacun de ses droits —
 * les listes du guide et du formulaire en dérivant directement, elles ne peuvent plus diverger.
 */

const schemaPath = path.resolve(__dirname, '../../../prisma/schema/schema.prisma')
const guidePath = path.resolve(__dirname, '../../../app/pages/guide/organizer/organizers.vue')

const schema = fs.readFileSync(schemaPath, 'utf8')
const guide = fs.readFileSync(guidePath, 'utf8')

/** Extrait les champs booléens `canX` déclarés dans un modèle Prisma. */
function rightsOfModel(modelName: string): string[] {
  const model = schema.match(new RegExp(`model ${modelName}\\s*\\{([\\s\\S]*?)\\n\\}`))
  if (!model) throw new Error(`Modèle Prisma introuvable : ${modelName}`)

  return [...model[1]!.matchAll(/^\s*(can[A-Za-z]+)\s+Boolean/gm)].map((m) => m[1]!)
}

/** Le schéma préfixe de `can` ; les droits de convention sont exposés sans ce préfixe. */
const withoutCanPrefix = (field: string) => field.charAt(3).toLowerCase() + field.slice(4)

describe('droits d’organisateur — la source unique suit le schéma Prisma', () => {
  it('couvre exactement les droits de convention', () => {
    const expected = rightsOfModel('ConventionOrganizer').map(withoutCanPrefix)
    expect([...CONVENTION_RIGHTS].sort()).toEqual([...expected].sort())
  })

  it('couvre exactement les droits par édition', () => {
    const expected = rightsOfModel('EditionOrganizerPermission')
    expect([...EDITION_RIGHTS].sort()).toEqual([...expected].sort())
  })
})

describe('guide des permissions — un libellé pour chaque droit', () => {
  /** Vérifie que la page du guide définit `<clé>: {` dans la section attendue. */
  function expectDocumented(section: string, keys: readonly string[]) {
    const block = guide.match(new RegExp(`${section}: \\{([\\s\\S]*?)\\n {4}\\}`))
    expect(block, `section ${section} introuvable dans le guide`).not.toBeNull()

    for (const key of keys) {
      expect(block![1], `${section}.${key} : libellé manquant dans le guide`).toContain(`${key}: {`)
    }
  }

  it('documente chaque droit de convention', () => {
    expectDocumented('conventionPerms', CONVENTION_RIGHTS)
  })

  it('documente chaque droit par édition', () => {
    expectDocumented('editionPerms', EDITION_RIGHTS.map(withoutCanPrefix))
  })
})
