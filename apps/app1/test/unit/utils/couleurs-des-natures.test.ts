import { describe, expect, it } from 'vitest'

import {
  useParticipantTypes,
  type ParticipantType,
} from '../../../app/composables/useParticipantTypes'

/**
 * Le code couleur des quatre natures de participant.
 *
 * ⚠️ POURQUOI CES TESTS EXISTENT. Au contrôle d'accès, les pastilles d'une personne à plusieurs
 * titres disent sa nature PAR LA COULEUR. Si cette couleur se perd, les quatre pastilles sortent
 * identiques : l'écran paraît marcher, il ne distingue simplement plus rien. Aucune erreur, aucun
 * test d'écran en échec — d'où ces garde-fous sur la configuration elle-même.
 */

const { getParticipantTypeConfig } = useParticipantTypes()

const NATURES: ParticipantType[] = ['ticket', 'volunteer', 'artist', 'organizer']

/** Les sept couleurs que les composants Nuxt UI acceptent en `color`. Relevé sur `UBadge`. */
const COULEURS_NUXT_UI = ['primary', 'secondary', 'success', 'info', 'warning', 'error', 'neutral']

describe('les couleurs des natures ne passent PAS par la prop `color` de Nuxt UI', () => {
  it('trois des quatre sont des palettes Tailwind, qu’un composant Nuxt UI refuse', () => {
    /*
     * ⚠️ LE PIÈGE QUI A COÛTÉ CE LOT. `:color="config.color"` paraît être la façon évidente de
     * colorer une pastille. Mais `UBadge` n'accepte que les sept couleurs SÉMANTIQUES, et devant
     * `blue`, `yellow` ou `purple` il retombe sur `primary` — sans erreur, sans avertissement.
     * Trois pastilles de la page en souffraient, toutes rendues dans la même teinte.
     *
     * Ce test n'interdit pas ces valeurs : il CONSTATE qu'elles sont hors du jeu de Nuxt UI, pour
     * que personne ne les y branche en croyant bien faire.
     */
    const horsDuJeu = NATURES.filter(
      (nature) => !COULEURS_NUXT_UI.includes(getParticipantTypeConfig(nature).color)
    )

    expect(horsDuJeu).toEqual(['ticket', 'artist', 'organizer'])
  })

  it('et `volunteer` est le faux ami : sa couleur EST sémantique', () => {
    /*
     * `primary` passerait la prop `color` sans broncher. C'est ce qui rend le défaut si trompeur :
     * sur le seul bénévole, `:color="config.color"` fonctionne — on en conclut que le motif est
     * bon, et les trois autres natures restent cassées.
     */
    expect(getParticipantTypeConfig('volunteer').color).toBe('primary')
  })
})

describe('les classes Tailwind, elles, distinguent bien les quatre natures', () => {
  // C'est la forme employée par l'écran : `bgClass`/`textClass` et leurs variantes sombres, du
  // Tailwind véritable, qui colore déjà les icônes des en-têtes de listes.
  const classesDe = (nature: ParticipantType) => {
    const config = getParticipantTypeConfig(nature)
    return [config.bgClass, config.textClass, config.darkBgClass, config.darkTextClass].join(' ')
  }

  it('quatre natures, quatre jeux de classes DIFFÉRENTS', () => {
    // Sans quoi le code couleur ne distingue rien : deux natures de la même teinte sont deux
    // natures qu'on confond au guichet.
    const jeux = NATURES.map(classesDe)

    expect(new Set(jeux).size).toBe(4)
  })

  it('aucune classe ne manque, pour aucune nature', () => {
    // Une classe absente donne `undefined` dans la liste, que Vue rend comme la chaîne
    // « undefined » : la pastille perd sa teinte et personne ne le voit en relisant le gabarit.
    for (const nature of NATURES) {
      expect(classesDe(nature), `nature « ${nature} »`).not.toContain('undefined')
    }
  })

  it('chaque nature porte un libellé traduisible', () => {
    // L'écran affiche `t(config.labelKey)`. Une clé vide afficherait une pastille muette.
    for (const nature of NATURES) {
      expect(getParticipantTypeConfig(nature).labelKey, `nature « ${nature} »`).toMatch(/^\w+\./)
    }
  })
})
