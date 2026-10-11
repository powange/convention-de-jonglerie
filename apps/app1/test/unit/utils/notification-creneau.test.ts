import { describe, it, expect } from 'vitest'

import { changementNotable } from '../../../../../layers/volunteers/server/utils/changement-de-creneau'

/**
 * Quels changements d'un créneau méritent de prévenir ceux qui le tiennent — constat B4.
 *
 * ## Pourquoi cette règle est isolée et pure
 *
 * Elle décide d'un ENVOI. Trop large, elle noie les vraies annonces et l'on cesse de les lire ;
 * trop étroite, un bénévole se présente à l'ancien horaire. Les deux défauts sont invisibles à
 * l'écran — on ne voit pas la notification qu'on n'a pas reçue.
 */
const base = {
  startDateTime: new Date('2026-08-01T10:00:00Z'),
  endDateTime: new Date('2026-08-01T12:00:00Z'),
  teamId: 'bar',
  delayMinutes: null,
}

describe('changementNotable', () => {
  /**
   * ⚠️⚠️ LE CAS QUI COMMANDE TOUT LE RESTE.
   *
   * Enregistrer le formulaire sans toucher aux dates renvoie le même instant sous la forme d'une
   * AUTRE instance de `Date`. Une comparaison d'objets (`avant.startDateTime !== apres.startDateTime`)
   * serait donc vraie à CHAQUE enregistrement : une notification par sauvegarde, et le jour où
   * l'horaire change vraiment, plus personne ne les lit. Ce défaut a déjà été payé sur le
   * covoiturage, où une modification d'annonce prévenait les passagers à chaque fois.
   */
  it('⚠️ NE DÉCLENCHE RIEN quand l’instant est le même dans un autre objet Date', () => {
    const apres = {
      ...base,
      startDateTime: new Date('2026-08-01T10:00:00Z'),
      endDateTime: new Date('2026-08-01T12:00:00Z'),
    }
    expect(apres.startDateTime).not.toBe(base.startDateTime) // bien deux objets distincts
    expect(changementNotable(base, apres)).toBe(false)
  })

  it('déclenche sur un changement d’heure de début', () => {
    expect(
      changementNotable(base, { ...base, startDateTime: new Date('2026-08-01T18:00:00Z') })
    ).toBe(true)
  })

  it('déclenche sur un changement d’heure de fin', () => {
    // Les deux bornes : un créneau rallongé de deux heures change la soirée de celui qui le tient.
    expect(
      changementNotable(base, { ...base, endDateTime: new Date('2026-08-01T14:00:00Z') })
    ).toBe(true)
  })

  it('déclenche sur un changement d’équipe', () => {
    expect(changementNotable(base, { ...base, teamId: 'cuisine' })).toBe(true)
  })

  it('déclenche quand une équipe est RETIRÉE', () => {
    // `null` est une valeur, pas une absence : le créneau n'est plus rattaché à rien.
    expect(changementNotable(base, { ...base, teamId: null })).toBe(true)
  })

  it('déclenche sur un retard annoncé, et sur son retrait', () => {
    /*
     * Le retard change l'heure à laquelle on doit se présenter — c'est le même sujet que les
     * dates. Et il se retire : quelqu'un qui a noté « une heure plus tard » après une fausse
     * manœuvre doit apprendre que ce n'est plus le cas.
     */
    expect(changementNotable(base, { ...base, delayMinutes: 60 })).toBe(true)
    expect(changementNotable({ ...base, delayMinutes: 60 }, base)).toBe(true)
  })

  it('traite `null` et `undefined` comme un même « pas de retard »', () => {
    // La colonne est nullable et le corps du PUT peut ne pas la mentionner : sans cette
    // normalisation, ne pas toucher au retard compterait pour un changement.
    expect(
      changementNotable({ ...base, delayMinutes: null }, {
        ...base,
        delayMinutes: undefined,
      } as never)
    ).toBe(false)
  })

  /**
   * ⚠️ CE QUI NE DÉCLENCHE RIEN, et c'est une DÉCISION autant qu'un comportement.
   *
   * Renommer un créneau, corriger sa description ou ouvrir une place de plus ne déplace personne :
   * l'heure et le lieu ne bougent pas. Notifier là-dessus ferait partir un message à chaque
   * correction de faute de frappe — et un écran de planification se corrige beaucoup.
   *
   * Si ce cas tombe, c'est que quelqu'un a élargi la règle : à lui de dire pourquoi.
   */
  it('⚠️ NE DÉCLENCHE RIEN sur le titre, la description ou le nombre de places', () => {
    const apres = { ...base } // ces champs ne sont même pas dans `EtatDuCreneau`
    expect(changementNotable(base, apres)).toBe(false)
  })
})
