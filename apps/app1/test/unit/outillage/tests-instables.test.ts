import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

const RACINE = process.cwd()
const CONFIG_PW = join(RACINE, 'playwright.config.ts')
const WORKFLOW = join(RACINE, '..', '..', '.github', 'workflows', 'tests.yml')

/**
 * Un test Playwright instable passait vert sans laisser de trace — constat A9.
 *
 * ## Le défaut
 *
 * `retries: process.env.CI ? 2 : 1` rejoue un test jusqu'à ce qu'il réussisse, et le seul
 * rapporteur était `html` — un artefact qu'il faut télécharger et ouvrir pour voir qu'une reprise
 * a eu lieu. Un test qui échoue une fois sur trois se cachait donc derrière les reprises jusqu'au
 * jour où il échoue trois fois de suite.
 *
 * ## 📍 MESURÉ AVANT D'EXIGER QUOI QUE CE SOIT
 *
 * Quatre runs consécutifs, relevés dans les journaux des sept lots : **547 tests passés, zéro
 * instable** à chaque fois. ⚠️ La fiche affirmait que « les instabilités connues du projet
 * (infobulles au doigt, hydratation, `expect.poll` à 30 s) se cachent derrière les reprises » —
 * elles ne s'y cachaient pas, il n'y avait aucune reprise.
 *
 * Ce qui restait vrai : **rien ne le mesurait**. Une instabilité apparue demain serait restée
 * invisible. L'état de référence étant zéro, la CI peut exiger zéro — même logique que le job
 * `audit`, dont le seuil critique est tenable parce qu'il est atteint.
 *
 * ## Ce que le lot ne change pas
 *
 * ⚠️ **Les reprises restent à 2.** Les baisser rendrait la CI fragile à la moindre lenteur du
 * runner, et sept lots Playwright en dépendent. Ce qui change est qu'une reprise ne passe plus
 * inaperçue : elle nomme son test dans le résumé de la PR et fait échouer le lot.
 */
describe('tests Playwright instables', () => {
  it('⚠️ LA CI PRODUIT UN RAPPORT EXPLOITABLE, PAS SEULEMENT DU HTML', async () => {
    /*
     * Le rapporteur `json` est ce que l'étape de CI compte ; `list` écrit le résumé dans le
     * journal du job, où il se lit sans rien télécharger. Sans eux, l'étape ne peut rien vérifier
     * et se contente d'un avertissement.
     */
    const config = await readFile(CONFIG_PW, 'utf8')

    expect(config).toContain("['json'")
    expect(config).toContain('playwright-resultats.json')
    expect(config).toContain("['list']")
    // Et le HTML reste : c'est lui qu'on ouvre pour comprendre un échec, avec trace et captures.
    expect(config).toContain("['html']")
  })

  it('⚠️ LES REPRISES RESTENT À 2 — on mesure, on ne durcit pas', async () => {
    /*
     * Ce cas garde une DÉCISION. Baisser les reprises ferait rougir la CI à la moindre lenteur du
     * runner, pour un défaut qui n'est pas dans le code. S'il tombe, c'est que quelqu'un a changé
     * ce réglage : à lui de dire pourquoi, en retirant ce cas et en l'écrivant.
     */
    const config = await readFile(CONFIG_PW, 'utf8')
    expect(config).toMatch(/retries:\s*process\.env\.CI\s*\?\s*2\s*:/)
  })

  it('⚠️ LE JOB REFUSE UN TEST INSTABLE, ET LE NOMME', async () => {
    const workflow = await readFile(WORKFLOW, 'utf8')

    /*
     * ⚠️ LA LIGNE ENTIÈRE, PAS LA SOUS-CHAÎNE. Un `toContain('Refuser un test instable')` est
     * satisfait par « Refuser un test instable-renomme » : le sabotage qui renommait l'étape
     * passait au vert. C'est la quatrième fois que ce piège mord dans ce dépôt — le nom cherché
     * est toujours le préfixe d'un autre.
     */
    const declaration = /^ {6}- name: Refuser un test instable$/m
    expect(workflow).toMatch(declaration)

    /*
     * ⚠️⚠️ ON SE PLACE SUR LA DÉCLARATION DE L'ÉTAPE, PAS SUR LA PREMIÈRE MENTION DE SON NOM.
     *
     * `indexOf('Refuser un test instable')` tombait sur le premier texte qui prononce ce nom — y
     * compris un COMMENTAIRE situé plus haut dans le fichier. C'est arrivé le 12/10/2026 : un
     * commentaire expliquant `--global-timeout` citait l'étape, la fenêtre de 400 caractères
     * partait de là, et la garde a déclaré l'étape dépourvue de son `if: always()` alors qu'elle
     * l'avait toujours. Une garde qui accuse à tort use la confiance qu'on lui porte aussi
     * sûrement qu'une garde muette.
     *
     * C'est le même piège que celui documenté juste au-dessus — « la ligne entière, pas la
     * sous-chaîne » —, appliqué cette fois à l'ANCRE et non au seul contrôle de présence.
     */
    // `always()` : sans lui l'étape serait sautée quand les tests échouent — précisément quand on
    // veut savoir si une reprise a eu lieu.
    const etape = workflow.slice(workflow.search(declaration))
    expect(etape.slice(0, 400)).toContain('if: always()')
    // Le nom du test fautif part dans le résumé de la PR, pas seulement dans le journal.
    expect(etape.slice(0, 2500)).toContain('GITHUB_STEP_SUMMARY')
    expect(etape.slice(0, 2500)).toContain("=== 'flaky'")
  })

  it('⚠️ PLAYWRIGHT S’ARRÊTE AVANT QUE LE JOB NE SOIT TUÉ', async () => {
    /*
     * ## Ce que ce cas garde, et pourquoi il existe
     *
     * Le 12/10/2026, le lot `gestion-3b` est resté 35 minutes et `timeout-minutes: 30` l'a tué.
     * Un job tué par ce plafond est annulé **dur** : les étapes suivantes, `if: always()`
     * comprises, ne s'exécutent PAS. Constaté sur ce run — six lots ont déposé leur rapport, le
     * septième AUCUN, et son journal répondait 404. Toute trace perdue, exactement dans le cas
     * où l'on en a besoin.
     *
     * `--global-timeout` fait que c'est Playwright qui s'arrête : il écrit son rapport, l'étape
     * « Refuser un test instable » le lit, l'artefact part, et le test fautif est NOMMÉ.
     *
     * ## 📍 CE QUI EST MESURÉ ICI N'EST PAS LE CHIFFRE, C'EST LA RELATION
     *
     * Figer `1200000` ne garantirait rien : c'est son écart avec le plafond du job qui fait que
     * les étapes d'envoi ont le temps de tourner. Les deux valeurs peuvent bouger, mais pas
     * l'ordre — et la marge exigée (cinq minutes) est celle dont l'envoi du rapport a besoin.
     */
    const workflow = await readFile(WORKFLOW, 'utf8')

    const blocPlaywright = /^ {2}playwright:$([\s\S]*?)(?=^ {2}\w[\w-]*:$)/m.exec(workflow)
    expect(blocPlaywright, 'le job `playwright` est introuvable dans le workflow').toBeTruthy()

    const plafond = /^ {4}timeout-minutes: (\d+)$/m.exec(blocPlaywright![1]!)
    expect(plafond, 'le job `playwright` n’a plus de `timeout-minutes`').toBeTruthy()

    const global = /--global-timeout (\d+)/.exec(blocPlaywright![1]!)
    expect(
      global,
      'Playwright n’est plus borné : un lot coincé serait tué par le plafond du job, et ' +
        'emporterait son rapport ET son journal avec lui'
    ).toBeTruthy()

    const minutesGlobal = Number(global![1]) / 60_000
    const minutesJob = Number(plafond![1])
    expect(
      minutesJob - minutesGlobal,
      `délai global ${minutesGlobal} min, plafond du job ${minutesJob} min : il faut au moins ` +
        `cinq minutes d'écart pour que le rapport ait le temps de partir`
    ).toBeGreaterThanOrEqual(5)
  })
})
