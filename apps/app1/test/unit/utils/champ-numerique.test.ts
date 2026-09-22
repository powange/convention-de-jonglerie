import { describe, expect, it } from 'vitest'

import { entierPositifDuChamp } from '../../../app/utils/champ-numerique'

/**
 * Ce qu'un champ numérique de formulaire contient réellement.
 *
 * Défaut constaté en production le 22/09/2025 : un organisateur efface le champ « Position » d'un
 * tarif, l'enregistrement échoue en 400 — « expected number, received string » — et rien à
 * l'écran ne désigne le champ fautif.
 *
 * La cause est `v-model.number`, qui n'est pas la garantie qu'on croit : Vue passe la valeur à
 * `parseFloat` et, quand le résultat est `NaN`, **rend la chaîne d'origine**. Le premier cas
 * ci-dessous est exactement celui de la production.
 */
describe('entierPositifDuChamp', () => {
  it('ramène un champ VIDÉ à la valeur par défaut', () => {
    // Le cas de production. `v-model.number` laisse passer `''`, que `z.number()` refuse.
    expect(entierPositifDuChamp('')).toBe(0)
    expect(entierPositifDuChamp('   ')).toBe(0)
  })

  it('laisse passer un entier, quelle que soit sa forme', () => {
    expect(entierPositifDuChamp(3)).toBe(3)
    expect(entierPositifDuChamp('3')).toBe(3)
    expect(entierPositifDuChamp(' 3 ')).toBe(3)
    expect(entierPositifDuChamp(0)).toBe(0)
  })

  it('écarte ce qui n’est pas un nombre', () => {
    // Un champ numérique accepte un collage : le navigateur n'en filtre pas le contenu.
    expect(entierPositifDuChamp('trois')).toBe(0)
    expect(entierPositifDuChamp('12abc')).toBe(0)
    expect(entierPositifDuChamp(null)).toBe(0)
    expect(entierPositifDuChamp(undefined)).toBe(0)
  })

  it('écarte une valeur NÉGATIVE', () => {
    // Le champ porte `min="0"`, mais la saisie au clavier passe outre dans plusieurs navigateurs.
    expect(entierPositifDuChamp(-1)).toBe(0)
    expect(entierPositifDuChamp('-5')).toBe(0)
  })

  it('écarte une valeur DÉCIMALE plutôt que de l’arrondir', () => {
    // Arrondir inventerait une valeur que personne n'a saisie. Le schéma attend `.int()` : ce
    // qui n'en est pas un retombe sur le défaut, qui lui est explicite.
    expect(entierPositifDuChamp(1.5)).toBe(0)
    expect(entierPositifDuChamp('2,5')).toBe(0)
  })

  it('accepte un repli autre que zéro', () => {
    // Pour coller au `default()` du schéma visé : l'absence doit vouloir dire la même chose des
    // deux côtés, sans quoi effacer un champ et ne jamais le remplir donnent deux résultats.
    expect(entierPositifDuChamp('', 1)).toBe(1)
    expect(entierPositifDuChamp('trois', 10)).toBe(10)
    expect(entierPositifDuChamp('4', 10)).toBe(4)
  })

  it('n’est pas dupé par les valeurs que `Number` traite trop gentiment', () => {
    // `Number([])` vaut 0 et `Number(true)` vaut 1 : ce ne sont pas des saisies, et les laisser
    // passer masquerait un bogue d'appelant derrière une valeur plausible.
    expect(entierPositifDuChamp(Number.NaN)).toBe(0)
    expect(entierPositifDuChamp(Number.POSITIVE_INFINITY)).toBe(0)
  })
})
