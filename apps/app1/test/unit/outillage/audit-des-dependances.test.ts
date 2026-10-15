import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

const WORKFLOW = join(process.cwd(), '..', '..', '.github', 'workflows', 'tests.yml')
const VERROU = join(process.cwd(), 'package-lock.json')

/**
 * La CI mesure-t-elle les vulnérabilités des dépendances ? — constat A1.
 *
 * ## ⚠️ Le défaut
 *
 * Les cinq installations du workflow passent `--no-audit` — ce qui est le bon choix, l'audit à
 * chaque `npm ci` coûterait du temps à chaque job —, et **aucun job ne lançait `npm audit`**. Le
 * compte montait donc sans que personne ne le voie : l'audit du 26 septembre relevait 87
 * vulnérabilités, celui du 9 octobre 101, celui du 11 octobre **156**.
 *
 * 📍 Le chiffre monte seul. Ce n'est pas le dépôt qui se dégrade, c'est l'inventaire des failles
 * connues qui grandit sous un arbre de dépendances figé — raison de plus pour le mesurer en
 * continu plutôt que lors d'un audit ponctuel.
 *
 * ## Ce que ce lot a corrigé, et ce qu'il n'a pas touché
 *
 * La seule vulnérabilité **critique** — `websocket-driver` ≤ 0.7.4, atteinte par
 * `firebase → @firebase/database → faye-websocket` — est levée en montant ce paquet à 0.7.5.
 * `faye-websocket` exige `>=0.5.1`, donc aucun `overrides` n'a été nécessaire. Avec treize autres
 * transitives (`axios`, `brace-expansion`, `fast-uri`, `js-yaml`, `joi`, `image-size`…), le compte
 * passe de **156 à 147** et les critiques de **1 à 0**.
 *
 * ⚠️ **Aucune version déclarée n'a changé par CE lot** : seul `package-lock.json` était modifié.
 *
 * 📍 **MISE À JOUR DU 15/10/2026 — les « lots suivants » ont eu lieu.** Ce paragraphe annonçait
 * que `nodemailer` et `sharp` relevaient de lots ultérieurs ; les deux sont faits, et chacun a
 * appris quelque chose qui ne se devinait pas :
 *
 * - `sharp` est passé en 0.35.5 et **n'a d'abord RIEN fermé** : `@nuxt/image → ipx@3.1.1` exige
 *   `sharp ^0.34.3` et gardait sa propre copie vulnérable. Il a fallu `ipx@4.0.0`, qui **déclare**
 *   `sharp ^0.35.5` — donc sans rien forcer.
 * - `nodemailer` est passé en 10.1.1, ses 11 avis sont levés, et `@types/nodemailer` a été
 *   **retiré** : la ligne 10 embarque ses propres définitions, et garder les types tiers (écrits
 *   pour la ligne 7) ferait écran avec eux.
 * - L'override `vue`, en revanche, **ne peut pas être monté** : fermer la XSS casse l'association
 *   libellé↔champ de `UFormField`, qui repose sur le `useId()` de Vue. Mesuré depuis : cette XSS
 *   n'est de toute façon pas atteignable ici, faute d'attribut dont le NOM vienne d'une entrée
 *   non fiable.
 *
 * ## ⚠️⚠️ POURQUOI `npm audit fix` N'EST PAS UTILISÉ
 *
 * Il **rétrograde**. Sur ce dépôt il propose `prisma@6.19.3` alors que le projet est en 7.9.0,
 * `firebase@9.14.0` et `@nuxt/ui@3.0.2` quand le projet est en 4.8.1. Ce ne sont pas des
 * correctifs mais des régressions de majeure déguisées en « fix available ». Les mises à jour de
 * ce lot ont donc été faites paquet par paquet, chacune vérifiée.
 */
describe('audit des dépendances', () => {
  it('⚠️ UN JOB DE CI MESURE LES VULNÉRABILITÉS', async () => {
    /*
     * Le cœur du constat : les installations passent `--no-audit`, donc sans job dédié personne ne
     * voit le compte. Ce cas vérifie que le job existe, qu'il écrit son relevé dans le résumé du
     * run — là où on le lit sans ouvrir le journal — et qu'il refuse une critique.
     */
    const workflow = await readFile(WORKFLOW, 'utf8')

    expect(workflow).toMatch(/^ {2}audit:$/m)
    expect(workflow).toContain('GITHUB_STEP_SUMMARY')
    expect(workflow).toContain('npm audit --audit-level=critical')
  })

  it('⚠️ CE JOB NE BLOQUE PAS `ci-verte`, ET C’EST DÉLIBÉRÉ', async () => {
    /*
     * Un avis publié pendant la nuit rendrait rouge une PR qui ne touche pas aux dépendances, et
     * bloquerait le dépôt pour une raison étrangère à son contenu. Le job rougit — donc se voit sur
     * la PR — sans fermer la porte.
     *
     * ⚠️ Ce cas garde une DÉCISION, pas un défaut. S'il tombe, c'est que quelqu'un a ajouté `audit`
     * aux besoins de `ci-verte` : à lui de dire pourquoi, en retirant ce cas et en l'écrivant.
     */
    const workflow = await readFile(WORKFLOW, 'utf8')
    const besoins = workflow.match(/^ {2}ci-verte:[\s\S]*?needs: \[([^\]]+)\]/m)?.[1] ?? ''

    expect(besoins).not.toContain('audit')
    // Et le témoin : la ligne a bien été trouvée, sinon l'assertion ci-dessus est creuse.
    expect(besoins).toContain('playwright')
  })

  it('⚠️ LA CRITIQUE EST LEVÉE : `websocket-driver` N’EST PLUS EN 0.7.4', async () => {
    /*
     * Le verrou, et non l'audit : interroger `npm audit` depuis un test le rendrait dépendant du
     * réseau et de l'inventaire du jour — il deviendrait rouge un matin, sans que le dépôt ait
     * changé. Ce qui est garanti ici est la version épinglée, qui est ce que ce lot a modifié.
     */
    const verrou = JSON.parse(await readFile(VERROU, 'utf8'))
    const entrees = Object.entries(verrou.packages as Record<string, { version?: string }>).filter(
      ([chemin]) => chemin.endsWith('node_modules/websocket-driver')
    )

    expect(
      entrees.length,
      'websocket-driver a disparu du verrou : ce cas peut être retiré'
    ).toBeGreaterThan(0)
    for (const [chemin, infos] of entrees) {
      expect(infos.version, `${chemin} est encore sur une version vulnérable`).not.toBe('0.7.4')
    }
  })
})
