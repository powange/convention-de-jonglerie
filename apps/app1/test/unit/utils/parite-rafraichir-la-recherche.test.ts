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

describe('rafraîchir les listes après un changement d’état', () => {
  it('le helper existe, et porte bien ce nom', () => {
    // Sans quoi les assertions suivantes seraient vraies pour la mauvaise raison : aucune
    // fonction ne contiendrait l'appel recherché, et aucune ne contiendrait non plus les
    // points d'API — un fichier renommé rendrait ce test vert et creux.
    const script = scriptSansCommentaires()
    expect(script).toContain(`function ${LE_RAFRAICHISSEMENT}(`)
  })

  it.each(APPELS_QUI_PERIMENT)('le parcours qui appelle « %s » rafraîchit la liste', (appel) => {
    const concernees = fonctions(scriptSansCommentaires()).filter((f) => f.includes(appel))

    // Au moins une : si l'appel disparaît du fichier, ce test doit le dire plutôt que passer.
    expect(concernees.length, `aucune fonction n'appelle « ${appel} »`).toBeGreaterThan(0)

    for (const fonction of concernees) {
      const nom = fonction.match(/(?:const|function) (\w+)/)?.[1] ?? '(anonyme)'
      expect(fonction, `« ${nom} » appelle ${appel} sans rafraîchir la liste`).toContain(
        LE_RAFRAICHISSEMENT
      )
    }
  })
})
