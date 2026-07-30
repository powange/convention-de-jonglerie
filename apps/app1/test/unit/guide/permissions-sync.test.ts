import fs from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

import {
  CONVENTION_RIGHTS,
  EDITION_MODULE_RIGHTS,
  EDITION_RIGHTS,
} from '../../../shared/utils/organizer-rights'

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
const storePath = path.resolve(__dirname, '../../../app/stores/editions.ts')
const menuPath = path.resolve(__dirname, '../../../app/layouts/edition-dashboard.vue')
const dashboardPath = path.resolve(__dirname, '../../../app/pages/editions/[id]/gestion/index.vue')

const schema = fs.readFileSync(schemaPath, 'utf8')
const guide = fs.readFileSync(guidePath, 'utf8')
const store = fs.readFileSync(storePath, 'utf8')
const menu = fs.readFileSync(menuPath, 'utf8')
const dashboard = fs.readFileSync(dashboardPath, 'utf8')

/**
 * Chemins d'écriture des droits d'organisateur. Chacun énumère les champs à la main : un droit
 * absent de l'un d'eux se coche dans le formulaire, s'enregistre en apparence, et se retrouve
 * décoché au retour — sans la moindre erreur.
 */
const WRITE_PATHS = [
  '../../../server/utils/organizer-management.ts',
  '../../../server/api/conventions/[id]/organizers.post.ts',
  '../../../server/api/conventions/[id]/organizers/[organizerId].put.ts',
  '../../../server/api/conventions/[id]/organizers/[organizerId].patch.ts',
].map((relative) => ({
  name: relative.split('/').pop()!,
  content: fs.readFileSync(path.resolve(__dirname, relative), 'utf8'),
}))

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

/**
 * Les droits métier décident de ce que l'utilisateur voit réellement. Un droit ajouté sans
 * méthode de store ni entrée de menu donne une fonctionnalité qui existe mais reste
 * inaccessible — c'est précisément ce qui s'était produit avant l'audit des permissions.
 */
describe('droits métier — accessibles depuis le store et le menu', () => {
  it('expose une méthode de store par droit métier', () => {
    for (const right of EDITION_MODULE_RIGHTS) {
      const method = `can${right.charAt(0).toUpperCase()}${right.slice(1)}`
      expect(store, `${method}() manquant dans le store des éditions`).toContain(
        `${method}(edition: Edition, userId: number)`
      )
    }
  })

  // La FAQ fait exception : son entrée de menu est volontairement ouverte plus largement, parce
  // que responsables d'équipe et bénévoles en créneau doivent pouvoir la consulter sur place.
  // Seules les modifications exigent `canManageFAQ`, appliqué côté page et côté API.
  const MENU_EXEMPT: readonly string[] = ['manageFAQ']

  it('déclare chaque droit métier dans le menu de gestion', () => {
    for (const right of EDITION_MODULE_RIGHTS) {
      if (MENU_EXEMPT.includes(right)) continue
      const method = `can${right.charAt(0).toUpperCase()}${right.slice(1)}`
      expect(menu, `${method} absent du menu de gestion`).toContain(`editionStore.${method}(`)
    }
  })

  /**
   * Le formulaire dérive de la source unique, mais les endpoints énumèrent leurs champs à la
   * main. La trésorerie s'y cochait et s'y « enregistrait » sans jamais être persistée.
   */
  it('accepte chaque droit métier sur les chemins d’écriture du serveur', () => {
    for (const right of EDITION_MODULE_RIGHTS) {
      const field = `can${right.charAt(0).toUpperCase()}${right.slice(1)}`
      for (const file of WRITE_PATHS) {
        expect(file.content, `${field} absent de ${file.name}`).toContain(field)
      }
    }
  })

  /**
   * Le menu ne suffit pas : le tableau de bord est la porte d'entrée de la gestion, et un module
   * qui n'y figure pas passe pour absent. La trésorerie y a manqué à sa livraison — le test ne
   * regardait alors que le menu, et n'a rien vu.
   */
  it('déclare chaque droit métier sur le tableau de bord', () => {
    for (const right of EDITION_MODULE_RIGHTS) {
      if (MENU_EXEMPT.includes(right)) continue
      const method = `can${right.charAt(0).toUpperCase()}${right.slice(1)}`
      expect(dashboard, `${method} absent du tableau de bord de gestion`).toContain(
        `editionStore.${method}(`
      )
    }
  })
})
