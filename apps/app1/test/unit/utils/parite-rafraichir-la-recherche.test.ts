import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Tout parcours qui change l'état d'un titre doit rafraîchir les listes de résultats.
 *
 * ⚠️ POURQUOI UNE GARDE SUR LA SOURCE. Le défaut ne se voit pas à l'écran de celui qui l'écrit :
 * on valide, la fiche ouverte se met à jour, les statistiques aussi — tout paraît marcher. C'est
 * seulement en FERMANT la modale qu'on retrouve la liste figée sur l'état d'avant. Trois parcours
 * sur quatre l'avaient oublié, et personne ne s'en est aperçu avant qu'un utilisateur le signale.
 *
 * 📍 Un test de rendu ne l'attraperait pas davantage : il faudrait monter la page entière,
 * authentifiée, répondre à cinq points d'API et fermer une modale. Cette garde-ci coûte une
 * lecture de fichier et dit exactement la même chose.
 */

const CHEMIN = join(
  import.meta.dirname,
  '../../../../../layers/ticketing/app/pages/editions/[id]/gestion/ticketing/access-control.vue'
)

/** Les appels qui changent l'état d'un titre, et périment donc les listes affichées. */
const APPELS_QUI_PERIMENT = ['validate-entry', 'invalidate-entry', '/refund']

/** Ce que chacun doit appeler ensuite. */
const LE_RAFRAICHISSEMENT = 'rafraichirLaRecherche'

/**
 * La partie `<script setup>`, COMMENTAIRES RETIRÉS.
 *
 * ⚠️ Les retirer n'est pas un détail. Les commentaires de ce fichier citent nommément les appels
 * qu'on cherche — c'est même leur rôle, puisqu'ils expliquent la règle. Les laisser ferait passer
 * au vert une fonction dont le seul `rafraichirLaRecherche` serait dans une phrase. Le même piège
 * a coûté cinq corrections successives au détecteur i18n du dépôt.
 */
function scriptSansCommentaires(): string {
  const source = readFileSync(CHEMIN, 'utf8')
  const debut = source.indexOf('<script setup')
  expect(debut, 'bloc <script setup> introuvable').toBeGreaterThan(-1)

  return source
    .slice(debut)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

/** Découpe grossièrement en fonctions : une entrée par déclaration de premier niveau. */
function fonctions(script: string): string[] {
  return script.split(/^(?=(?:const \w+ = (?:async )?\(|(?:async )?function \w+\())/m)
}

/**
 * Le rafraîchissement est-il appelé — directement, ou par qui déclenche ce bloc ?
 *
 * ## ⚠️ POURQUOI L'INDIRECTION DOIT ÊTRE SUIVIE
 *
 * Ce test exigeait que le point d'API et le rafraîchissement vivent dans la MÊME fonction. C'était
 * vrai des parcours écrits à la main : `$fetch`, puis le toast, puis `rafraichirLaRecherche()`.
 *
 * Avec `useApiAction`, le point d'API vit dans une DÉCLARATION (`const { execute: … } =
 * useApiAction('…/validate-entry', …)`) et le rafraîchissement dans la fonction qui appelle cet
 * `execute`, ou dans l'`onSuccess` du bloc. Les deux sont alors dans des blocs différents, et
 * l'ancienne règle rendait un faux positif — vérifié : le rafraîchissement était bien appelé.
 *
 * On suit donc le nom de l'`execute` jusqu'à son appelant. L'exigence est inchangée : un parcours
 * qui périme les listes doit les rafraîchir. Seul le chemin pour le constater a changé.
 */
function rafraichitDirectementOuParSonAppelant(script: string, bloc: string): boolean {
  // Cas 1 : dans le bloc même — un parcours encore écrit à la main, ou un `onSuccess` qui le fait.
  if (bloc.includes(LE_RAFRAICHISSEMENT)) return true

  // Cas 2 : le bloc déclare un `execute` ; c'est son appelant qui rafraîchit.
  const alias = [...bloc.matchAll(/execute:\s*(\w+)/g)].map((m) => m[1]!)
  if (alias.length === 0) return false

  return alias.some((nom) =>
    fonctions(script).some(
      (autre) => autre !== bloc && autre.includes(`${nom}(`) && autre.includes(LE_RAFRAICHISSEMENT)
    )
  )
}

describe('rafraîchir les listes après un changement d’état', () => {
  it('le helper existe, et porte bien ce nom', () => {
    // Sans quoi les assertions suivantes seraient vraies pour la mauvaise raison : aucune
    // fonction ne contiendrait l'appel recherché, et aucune ne contiendrait non plus les
    // points d'API — un fichier renommé rendrait ce test vert et creux.
    const script = scriptSansCommentaires()
    expect(script).toContain(`function ${LE_RAFRAICHISSEMENT}(`)
  })

  it.each(APPELS_QUI_PERIMENT)('le parcours qui appelle « %s » rafraîchit la liste', (appel) => {
    const script = scriptSansCommentaires()
    const concernees = fonctions(script).filter((f) => f.includes(appel))

    // Au moins une : si l'appel disparaît du fichier, ce test doit le dire plutôt que passer.
    expect(concernees.length, `aucune fonction n'appelle « ${appel} »`).toBeGreaterThan(0)

    for (const fonction of concernees) {
      const nom = fonction.match(/(?:const|function) (\w+)/)?.[1] ?? '(anonyme)'
      expect(
        rafraichitDirectementOuParSonAppelant(script, fonction),
        `« ${nom} » appelle ${appel} sans rafraîchir la liste`
      ).toBe(true)
    }
  })
})
