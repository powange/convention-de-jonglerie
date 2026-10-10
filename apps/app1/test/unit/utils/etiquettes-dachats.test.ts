import { describe, expect, it } from 'vitest'

import { etiquettesDesAchats } from '../../../../../layers/ticketing/app/utils/etiquettes-dachats'

/**
 * Les étiquettes de l'axe du graphique des achats — constat B11, moitié client.
 *
 * ## ⚠️ LE DÉFAUT
 *
 * Le serveur composait ces libellés lui-même, en `setLocale('fr')` et à l'heure d'UTC. Un
 * organisateur qui lit l'application en anglais voyait donc un axe en français, et toujours décalé :
 * une tranche de 0 h à Paris s'annonçait à l'heure de Greenwich. Le graphique des validations,
 * juste à côté sur le même écran, avait déjà été corrigé — les deux courbes se lisaient côte à côte
 * sans parler ni du même temps ni de la même langue.
 *
 * ## ⚠️⚠️ CE QUI REND CES CAS NON CREUX
 *
 * Deux témoins bornent les autres : la MÊME tranche rendue dans deux langues, et la MÊME tranche
 * rendue dans deux fuseaux. Sans eux, une fonction qui ignorerait l'un ou l'autre de ses arguments
 * passerait au vert — et c'est précisément le défaut qu'on vient de corriger.
 *
 * ⚠️ Les libellés ne sont PAS comparés caractère à caractère : `toLocaleString` suit la version
 * d'ICU embarquée, et « lun. » y a déjà changé de ponctuation. Ce qu'on éprouve, c'est que la
 * valeur CHANGE quand la langue ou le fuseau change, et que la date affichée est la bonne.
 */
const PARIS = 'Europe/Paris'

/** 23 h 30 UTC le 14/06 : 1 h 30 du matin le 15 à Paris, encore le 14 à Greenwich. */
const MINUIT_PASSE_A_PARIS = '2026-06-14T23:30:00Z'

describe('etiquettesDesAchats', () => {
  it('⚠️ DATE LA TRANCHE À L’HEURE DU LIEU, et non à celle du lecteur', () => {
    const [aParis] = etiquettesDesAchats([MINUIT_PASSE_A_PARIS], 1440, PARIS, 'fr')
    const [aGreenwich] = etiquettesDesAchats([MINUIT_PASSE_A_PARIS], 1440, 'UTC', 'fr')

    expect(aParis).toContain('15/06')
    // LE TÉMOIN : sans fuseau pris en compte, les deux seraient identiques et le cas ci-dessus ne
    // prouverait rien.
    expect(aGreenwich).toContain('14/06')
  })

  it('⚠️ SUIT LA LANGUE DE L’ÉCRAN', () => {
    const [enFrancais] = etiquettesDesAchats([MINUIT_PASSE_A_PARIS], 1440, PARIS, 'fr')
    const [enAnglais] = etiquettesDesAchats([MINUIT_PASSE_A_PARIS], 1440, PARIS, 'en')

    // Le jour de la semaine est le seul mot de cette forme : c'est lui qui change de langue.
    expect(enFrancais).not.toBe(enAnglais)
    // Et la date reste la même des deux côtés : seule la langue a bougé.
    expect(enFrancais).toContain('15/06')
  })

  it('donne son heure à la tranche de douze heures', () => {
    // Deux tranches par jour qui ne diffèrent que par l'heure : sans elle, l'axe porterait deux
    // fois la même étiquette et on ne saurait plus laquelle est le matin.
    const [matin, apresMidi] = etiquettesDesAchats(
      ['2026-06-15T00:00:00+02:00', '2026-06-15T12:00:00+02:00'],
      720,
      PARIS,
      'fr'
    )

    expect(matin).not.toBe(apresMidi)
    expect(matin).toContain('15/06')
    expect(apresMidi).toContain('15/06')
  })

  it('fait précéder la semaine du mot qu’on lui donne', () => {
    /*
     * La granularité hebdomadaire est la seule des quatre à porter un mot traduit, et un util n'a
     * pas accès à l'i18n : l'appelant le fournit. Sans ce détour, « Semaine du » serait revenu en
     * français en dur — exactement ce que ce lot retire du serveur.
     */
    const [etiquette] = etiquettesDesAchats(
      ['2026-06-15T00:00:00+02:00'],
      10080,
      PARIS,
      'fr',
      (date) => `Semaine du ${date}`
    )

    expect(etiquette).toBe('Semaine du 15/06')
  })

  it('rend la date seule quand personne ne dit comment nommer la semaine', () => {
    // Un appelant qui n'a pas de traduction sous la main ne doit pas se retrouver avec un axe vide.
    const [etiquette] = etiquettesDesAchats(['2026-06-15T00:00:00+02:00'], 10080, PARIS, 'fr')

    expect(etiquette).toBe('15/06')
  })

  it('nomme le mois et l’année à la granularité mensuelle', () => {
    const [etiquette] = etiquettesDesAchats(['2026-06-01T00:00:00+02:00'], 43200, PARIS, 'fr')

    expect(etiquette).toContain('2026')
    // Et plus le jour de la semaine, qui n'a aucun sens sur une tranche d'un mois.
    expect(etiquette).not.toContain('01/06')
  })

  it('retombe sur la forme du jour pour une granularité inconnue', () => {
    /*
     * Une granularité que personne n'a prévue vaut mieux lisible que vide : un axe sans étiquette
     * se lit comme un graphique cassé, alors que le découpage, lui, serait correct.
     */
    const [etiquette] = etiquettesDesAchats(['2026-06-15T00:00:00+02:00'], 99, PARIS, 'fr')

    expect(etiquette).toContain('15/06')
  })
})
