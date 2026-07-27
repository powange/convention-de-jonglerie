import fs from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

/**
 * Garde-fou contre la dérive du guide des permissions.
 *
 * Les droits d'organisateur sont énumérés à la main à plusieurs endroits, dont la page
 * /guide/organizer/organizers. Rien ne signalait jusqu'ici qu'un droit ajouté au schéma n'y
 * était pas documenté : c'est ainsi que Workshops, FAQ, Tâches et Stock sont restés absents du
 * guide pendant des mois, et que deux droits inventés (« Spectacles », « Carte ») y ont figuré
 * sans jamais avoir existé.
 *
 * Ce test compare les deux listes et échoue dans les deux sens.
 */

const schemaPath = path.resolve(__dirname, '../../../prisma/schema/schema.prisma')
const guidePath = path.resolve(__dirname, '../../../app/pages/guide/organizer/organizers.vue')

const schema = fs.readFileSync(schemaPath, 'utf8')
const guide = fs.readFileSync(guidePath, 'utf8')

/** Extrait les champs booléens `canX` déclarés dans un modèle Prisma. */
function rightsOfModel(modelName: string): string[] {
  const model = schema.match(new RegExp(`model ${modelName}\\s*\\{([\\s\\S]*?)\\n\\}`))
  if (!model) throw new Error(`Modèle Prisma introuvable : ${modelName}`)

  return [...model[1].matchAll(/^\s*(can[A-Za-z]+)\s+Boolean/gm)].map((m) => m[1]!)
}

/** Extrait un tableau de clés déclaré dans la page du guide. */
function guideKeys(constName: string): string[] {
  const declaration = guide.match(new RegExp(`const ${constName} = \\[([\\s\\S]*?)\\]`))
  if (!declaration) throw new Error(`Constante introuvable dans le guide : ${constName}`)

  return [...declaration[1].matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]!)
}

/**
 * Le guide nomme les droits sans le préfixe `can`, et en minuscule initiale :
 * `canManageFAQ` → `manageFAQ`, `canEdit` → `edit`.
 */
const toGuideKey = (field: string) => field.charAt(3)!.toLowerCase() + field.slice(4)

describe('guide des permissions — synchronisation avec le schéma Prisma', () => {
  it('documente exactement les droits de convention', () => {
    const expected = rightsOfModel('ConventionOrganizer').map(toGuideKey)
    expect([...guideKeys('CONVENTION_RIGHT_KEYS')].sort()).toEqual([...expected].sort())
  })

  it('documente exactement les droits par édition', () => {
    const expected = rightsOfModel('EditionOrganizerPermission').map(toGuideKey)
    expect([...guideKeys('EDITION_RIGHT_KEYS')].sort()).toEqual([...expected].sort())
  })

  it('fournit un libellé et une description pour chaque droit documenté', () => {
    const sections = {
      conventionPerms: guideKeys('CONVENTION_RIGHT_KEYS'),
      editionPerms: guideKeys('EDITION_RIGHT_KEYS'),
    }

    for (const [section, keys] of Object.entries(sections)) {
      for (const key of keys) {
        // Les libellés vivent dans l'objet `messages` de la page, sous sections.<section>.<clé>.
        const block = guide.match(new RegExp(`${section}: \\{([\\s\\S]*?)\\n {4}\\}`))
        expect(block, `section ${section} introuvable`).not.toBeNull()
        expect(block![1], `${section}.${key} : libellé manquant`).toContain(`${key}: {`)
      }
    }
  })
})
