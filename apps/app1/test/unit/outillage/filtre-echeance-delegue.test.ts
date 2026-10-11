import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Les deux écrans qui filtrent une échéance délèguent la règle — constat B4.
 *
 * ## ⚠️ POURQUOI UNE GARDE DE SOURCE, en plus des tests de la règle et de son branchement
 *
 * La règle a ses 15 cas, et son branchement sur « mes tâches » est éprouvé en montant la page. Le
 * TABLEAU D'UN GROUPE, lui, n'a aucun test — et c'est pourtant l'écran principal du module. Le
 * monter coûterait cher pour une seule ligne d'appel ; ce qui est en jeu n'est pas son rendu mais
 * le fait qu'il ne refasse pas le calcul chez lui.
 *
 * Car c'est exactement ainsi que le défaut est né : les deux écrans portaient la MÊME vingtaine de
 * lignes, recopiée, et le découpage des journées y lisait le fuseau du navigateur des deux côtés.
 * Corriger l'un sans l'autre aurait donné deux filtres qui ne répondent plus la même chose — pire
 * qu'un seul défaut partagé, parce qu'invisible.
 *
 * ## Ce que la garde tient, dans les deux sens
 *
 * Elle exige l'APPEL à la règle partagée **et** l'absence de la forme fautive. Le second seul ne
 * prouverait rien : supprimer le filtre entier le satisferait.
 */
const RACINE = join(process.cwd(), '..', '..')

/** Les deux écrans qui proposent un filtre d'échéance. */
const ECRANS = [
  'apps/app1/app/pages/editions/[id]/my-tasks.vue',
  'layers/tasks/app/pages/editions/[id]/gestion/tasks/[groupId].vue',
]

/**
 * La forme fautive : un minuit reconstruit à partir de la pendule LOCALE.
 *
 * `new Date(now.getFullYear(), now.getMonth(), now.getDate())` fabrique minuit dans le fuseau de
 * la machine qui exécute — le navigateur du lecteur. C'est la ligne qui faisait basculer d'un jour
 * les échéances d'une édition située ailleurs.
 */
const MINUIT_LOCAL = /new Date\(\s*\w+\.getFullYear\(\)/

const lire = (chemin: string) => readFile(join(RACINE, chemin), 'utf8')

describe('filtre d’échéance : une seule règle pour les deux écrans', () => {
  it('⚠️ LES DEUX ÉCRANS APPELLENT LA RÈGLE PARTAGÉE', async () => {
    for (const chemin of ECRANS) {
      const source = await lire(chemin)
      expect(
        source.includes('filtrerParEcheance('),
        `${chemin} ne délègue plus le filtre d'échéance : la règle serait recopiée, et c'est ` +
          `ainsi que le fuseau du navigateur s'est glissé dans les deux écrans`
      ).toBe(true)
    }
  })

  it('aucun n’y reconstruit minuit sur la pendule locale', async () => {
    for (const chemin of ECRANS) {
      const source = await lire(chemin)
      expect(
        MINUIT_LOCAL.test(source),
        `${chemin} refabrique un minuit LOCAL. Une échéance est une heure de LIEU : passer par ` +
          `\`journeeDans\` et le fuseau de l'édition (cf. shared/utils/filtre-echeance-taches.ts)`
      ).toBe(false)
    }
  })

  it('le balayage lit bien les deux fichiers — il ne conclut pas sur le vide', async () => {
    /*
     * Les deux cas ci-dessus sont vrais sur un fichier VIDE ou introuvable si la lecture échouait
     * sans lever. Un chemin qui change d'un renommage laisserait alors la garde au vert en ne
     * vérifiant plus rien — défaut déjà payé plusieurs fois dans ce dépôt.
     */
    for (const chemin of ECRANS) {
      const source = await lire(chemin)
      expect(source.length, `${chemin} est vide : le balayage est cassé`).toBeGreaterThan(1000)
    }
  })
})
