import { useEventListener } from '@vueuse/core'

/**
 * La séquence, en minuscules.
 *
 * `KeyboardEvent.key` rend `ArrowUp` mais `b` ou `B` selon la majuscule : tout est donc comparé
 * en minuscules, sans quoi le code échouerait pour qui a le verrouillage majuscule actif.
 */
const SEQUENCE = [
  'arrowup',
  'arrowup',
  'arrowdown',
  'arrowdown',
  'arrowleft',
  'arrowright',
  'arrowleft',
  'arrowright',
  'b',
  'a',
] as const

/** Les éléments où l'on SAISIT : les flèches y déplacent un curseur, elles ne nous sont pas destinées. */
const SAISIES = ['INPUT', 'TEXTAREA', 'SELECT']

/**
 * Détecte le Konami Code au clavier et appelle `auKonami` à chaque fois qu'il est saisi.
 *
 * ## Une fenêtre glissante, et non un compteur d'avancement
 *
 * Le réflexe est de retenir un index et de le remettre à zéro dès qu'une touche sort de la
 * séquence. Il a un défaut concret : **`↑ ↑ ↑ ↓ ↓ ← → ← → b a` ne fonctionnerait pas.** Au
 * troisième `↑`, l'index est à 2, la touche attendue est `↓`, donc remise à zéro — alors que les
 * deux derniers `↑` forment bel et bien le début de la séquence. L'utilisateur qui appuie une fois
 * de trop ne comprend pas pourquoi rien ne se passe.
 *
 * On retient donc les **dix dernières frappes** et on regarde si elles sont la séquence. Tous les
 * recouvrements se résolvent d'eux-mêmes, et une frappe parasite se contente de sortir de la
 * fenêtre au bout de dix touches au lieu de tout annuler.
 *
 * ## Ce qu'elle ne fait pas
 *
 * - **Aucun `preventDefault`.** Les flèches font défiler la page : les intercepter priverait de
 *   défilement au clavier quiconque n'a jamais entendu parler de ce code.
 * - **Aucune répétition.** Garder `↑` enfoncé émet des `keydown` en rafale ; les compter
 *   permettrait de déclencher le code en appuyant sur trois touches au lieu de dix.
 */
export function useKonamiCode(auKonami: () => void) {
  const frappes: string[] = []

  useEventListener('keydown', (evenement: KeyboardEvent) => {
    if (evenement.repeat) return

    const cible = evenement.target as HTMLElement | null
    if (cible && (cible.isContentEditable || SAISIES.includes(cible.tagName))) {
      // La frappe s'adressait à un champ, pas à la page : on repart de zéro plutôt que de laisser
      // un « b » puis un « a » tapés dans une recherche compléter une séquence commencée avant.
      frappes.length = 0
      return
    }

    frappes.push(evenement.key.toLowerCase())
    if (frappes.length > SEQUENCE.length) frappes.shift()
    if (frappes.length < SEQUENCE.length) return
    if (!SEQUENCE.every((touche, place) => touche === frappes[place])) return

    /*
     * La fenêtre n'est PAS vidée, et ce n'est pas un oubli : pour correspondre une seconde fois,
     * il faut que les dix dernières frappes soient la séquence — donc la retaper entièrement. Un
     * `b a` ajouté après un code réussi donne `… ← → b a b a`, qui ne correspond à rien. La
     * séquence ne se recouvre elle-même que sur ses deux `↑` de tête, jamais sur sa fin.
     */
    auKonami()
  })
}
