import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { verifierCouverture } from '../../../scripts/lot-playwright.mjs'
import LOTS from '../../e2e/playwright/lots-edition-management.json'

/**
 * La couverture des lots Playwright.
 *
 * Les lots sont des listes de fichiers écrites à la main, et c'est délibéré : un rééquilibrage
 * automatique par durée a déjà cassé la CI en réunissant deux fichiers qui se contredisent.
 *
 * Le revers est qu'une liste s'oublie. Un fichier de test ajouté sans être assigné ne
 * s'exécuterait NULLE PART, et tous les lots resteraient verts — l'échec le plus coûteux, parce
 * qu'il ne se voit pas. Ce test tient cette garantie hors de la CI, et le contrôle recommence
 * dans la CI à chaque lot.
 */

const DOSSIER = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'e2e',
  'playwright',
  'edition-management'
)

const surDisque = () => readdirSync(DOSSIER).filter((n) => n.endsWith('.spec.ts'))

describe('les lots couvrent le dossier de tests', () => {
  it('assigne chaque fichier présent sur le disque', () => {
    const { oublies } = verifierCouverture(surDisque(), LOTS)

    expect(oublies, `à ajouter dans lots-edition-management.json : ${oublies.join(', ')}`).toEqual(
      []
    )
  })

  it('ne cite aucun fichier qui n’existe plus', () => {
    const { fantomes } = verifierCouverture(surDisque(), LOTS)

    expect(fantomes).toEqual([])
  })

  it('n’exécute aucun fichier deux fois', () => {
    const { doublons } = verifierCouverture(surDisque(), LOTS)

    expect(doublons).toEqual([])
  })
})

describe('verifierCouverture', () => {
  const LOTS_FICTIFS = { a: ['un.spec.ts'], b: ['deux.spec.ts'] }

  it('ne signale rien quand tout concorde', () => {
    expect(verifierCouverture(['un.spec.ts', 'deux.spec.ts'], LOTS_FICTIFS)).toEqual({
      oublies: [],
      fantomes: [],
      doublons: [],
    })
  })

  it('signale le fichier ajouté et jamais assigné', () => {
    // LE cas qui justifie ce garde-fou : sans lui, ce fichier ne tournerait nulle part.
    const { oublies } = verifierCouverture(
      ['un.spec.ts', 'deux.spec.ts', 'neuf.spec.ts'],
      LOTS_FICTIFS
    )

    expect(oublies).toEqual(['neuf.spec.ts'])
  })

  it('signale un lot qui cite un fichier supprimé', () => {
    const { fantomes } = verifierCouverture(['un.spec.ts'], LOTS_FICTIFS)

    expect(fantomes).toEqual(['deux.spec.ts'])
  })

  it('signale un fichier présent dans deux lots', () => {
    const doubles = { a: ['un.spec.ts'], b: ['un.spec.ts'] }
    const { doublons } = verifierCouverture(['un.spec.ts'], doubles)

    expect(doublons).toEqual(['un.spec.ts'])
  })
})
