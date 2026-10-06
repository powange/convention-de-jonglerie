import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * La section du guichet ne doit poser aucun drapeau que personne ne lit.
 *
 * ⚠️ CE DÉFAUT EST PARTI EN PRODUCTION. En sortant le corps de la fiche dans un composant, le
 * bouton « Marquer comme remboursé » a gardé son `confirmationDuRemboursement = true` tandis que la
 * modale de confirmation restait chez le parent — avec un drapeau du même nom, mais le sien. La
 * section posait donc un drapeau local que plus rien ne lisait : **le bouton ne faisait RIEN**.
 *
 * Pas d'erreur, pas de message, aucune trace dans les journaux. Un clic sans effet au guichet,
 * devant la personne à qui l'on devait de l'argent. Ni le typage, ni le lint, ni la compilation ne
 * le voient : écrire dans un `ref` est parfaitement valide.
 *
 * 📍 La règle tenue ici : une section N'OUVRE PAS de modale, elle ÉMET. Le parent décide. C'est ce
 * qui rend l'oubli impossible — un signal non écouté se voit dans le gabarit du parent, là où un
 * drapeau orphelin se cache dans huit cents lignes de script.
 */

const SECTION = join(
  import.meta.dirname,
  '../../../../../layers/ticketing/app/components/ticketing/ParticipantTitleSection.vue'
)

function sansCommentaires(chemin: string): string {
  return readFileSync(chemin, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

describe('la section du guichet', () => {
  it('⚠️ ne tient AUCUN drapeau de confirmation', () => {
    /*
     * Un `ref` nommé `confirmation…` ou `show…Modal` dans la section est le signe exact du défaut :
     * la modale qu'il commanderait vit chez le parent.
     */
    const script = sansCommentaires(SECTION)
    const drapeaux = [...script.matchAll(/const (confirmation\w*|show\w*Modal)\s*=\s*ref\(/g)].map(
      (m) => m[1]
    )

    expect(drapeaux, `drapeaux de confirmation trouvés : ${drapeaux.join(', ')}`).toEqual([])
  })

  it('demande au parent, par un signal', () => {
    // Le témoin positif : sans lui, supprimer le bouton ferait passer le test précédent.
    const script = sansCommentaires(SECTION)

    expect(script).toContain("'demander-remboursement'")
    expect(script).toContain("emit('demander-remboursement'")
  })

  it('et CHAQUE signal qu’elle déclare est écouté par le parent', () => {
    /*
     * ⚠️ L'AUTRE MOITIÉ DU MÊME DÉFAUT. Émettre un signal que personne n'écoute ne lève rien non
     * plus : Vue ignore un événement sans auditeur. Le bouton serait tout aussi mort.
     *
     * 📍 TOUS les signaux, et non les seuls `demander-…` : ma première version ne regardait que ce
     * préfixe, et le signal suivant que j'ai ajouté — `remise-rendue` — y échappait. Une garde qui
     * ne couvre que les cas déjà écrits ne garde rien.
     */
    const script = sansCommentaires(SECTION)
    const parent = sansCommentaires(
      join(
        import.meta.dirname,
        '../../../../../layers/ticketing/app/components/ticketing/ParticipantDetailsModal.vue'
      )
    )

    const bloc = script.slice(script.indexOf('defineEmits<{'))
    const declaration = bloc.slice(0, bloc.indexOf('}>()'))

    // Les noms entre quotes — `'remise-rendue':` — et les noms nus — `refund:`.
    const signaux = [
      ...[...declaration.matchAll(/^\s*'([\w:-]+)'\s*:/gm)].map((m) => m[1]),
      ...[...declaration.matchAll(/^\s*([a-z][\w]*)\s*:\s*\[/gm)].map((m) => m[1]),
    ]

    expect(
      signaux.length,
      'aucun signal déclaré : le bloc a-t-il changé de forme ?'
    ).toBeGreaterThan(3)

    for (const signal of signaux) {
      // `update:selection` s'écoute `@update:selection=`, comme les autres.
      expect(parent, `le parent n'écoute pas « ${signal} »`).toContain(`@${signal}=`)
    }
  })
})
