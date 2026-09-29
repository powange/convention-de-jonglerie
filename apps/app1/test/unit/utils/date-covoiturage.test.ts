import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { formatCarpoolDate } from '../../../../../layers/carpool/app/utils/date-covoiturage'

/**
 * L'heure d'un trajet de covoiturage, au fuseau du NAVIGATEUR.
 *
 * ⚠️ CE QUE CES TESTS VERROUILLENT. Quatre écrans affichaient la même donnée de trois façons : la
 * carte d'une offre forçait `Europe/Paris`, son détail prenait le navigateur, et les deux écrans
 * d'une demande passaient par le `formatDate` partagé — qui force aussi `Europe/Paris`. Hors de
 * France, une même offre montrait donc DEUX heures différentes selon qu'on la lisait dans la liste
 * ou dans son détail, sans que rien ne dise laquelle était la bonne.
 *
 * Le fuseau du navigateur est un CHOIX, pris et documenté à la saisie : « je pars samedi 8 h de
 * Lyon » désigne 8 h à Lyon, pas 8 h sur le lieu de l'événement, et le fuseau de la ville de départ
 * n'est pas connu — seule l'adresse l'est, en texte libre. Ces tests ne le remettent pas en cause,
 * ils vérifient qu'il est tenu.
 *
 * ⚠️ D'où le `process.env.TZ` posé ici : sans fuseau contrôlé, un test de formatage mesure la
 * machine qui l'exécute. Il passerait en conteneur (UTC) et tomberait sur un poste à Paris, ou
 * l'inverse — et surtout, il ne saurait pas distinguer « suit le navigateur » de « force Paris »,
 * ce qui est exactement la question posée.
 */

const TZ_ORIGINE = process.env.TZ

/** Un instant sans ambiguïté : 22 h UTC, donc déjà le lendemain à Paris. */
const VEILLE_A_MINUIT_MOINS_DEUX = '2026-06-13T22:00:00.000Z'

describe('formatCarpoolDate — fuseau de New York', () => {
  beforeAll(() => {
    process.env.TZ = 'America/New_York'
  })
  afterAll(() => {
    process.env.TZ = TZ_ORIGINE
  })

  it('affiche l’heure de la machine, et non celle de Paris', () => {
    // 22 h UTC = 18 h à New York le 13, mais 00 h le 14 à Paris. L'ancienne carte d'offre, qui
    // forçait Europe/Paris, annonçait donc un départ le dimanche à un lecteur pour qui c'était
    // encore samedi soir.
    const rendu = formatCarpoolDate(VEILLE_A_MINUIT_MOINS_DEUX, 'fr')

    expect(rendu).toContain('13')
    expect(rendu).toContain('juin')
    expect(rendu).toContain('samedi')
    expect(rendu).not.toContain('dimanche')
    expect(rendu).not.toContain('14')
  })
})

describe('formatCarpoolDate — fuseau de Paris', () => {
  beforeAll(() => {
    process.env.TZ = 'Europe/Paris'
  })
  afterAll(() => {
    process.env.TZ = TZ_ORIGINE
  })

  it('bascule bien au lendemain pour le même instant', () => {
    // Le pendant du cas précédent : la MÊME donnée, un autre lecteur, une autre journée. C'est
    // l'écart entre les deux qui prouve que le fuseau suivi est celui de la machine.
    const rendu = formatCarpoolDate(VEILLE_A_MINUIT_MOINS_DEUX, 'fr')

    expect(rendu).toContain('14')
    expect(rendu).toContain('dimanche')
  })

  it('rend le jour, le mois, le nom du jour et l’heure — et PAS l’année', () => {
    // L'année disparaît volontairement : elle était présente sur les deux écrans d'une demande
    // (`formatDate` en format « long ») et absente des cartes d'offre. Un trajet se publie pour
    // les jours qui viennent ; l'uniformité se fait donc sans elle.
    const rendu = formatCarpoolDate('2026-06-15T08:30:00.000Z', 'fr')

    expect(rendu).toContain('lundi')
    expect(rendu).toContain('15')
    expect(rendu).toContain('juin')
    expect(rendu).toContain('10:30') // 08:30 UTC = 10:30 à Paris en été
    expect(rendu).not.toContain('2026')
  })

  it('suit la locale demandée', () => {
    expect(formatCarpoolDate('2026-06-15T08:30:00.000Z', 'en')).toContain('Monday')
    expect(formatCarpoolDate('2026-06-15T08:30:00.000Z', 'de')).toContain('Montag')
  })

  it('accepte un objet Date autant qu’une chaîne', () => {
    const chaine = formatCarpoolDate('2026-06-15T08:30:00.000Z', 'fr')
    expect(formatCarpoolDate(new Date('2026-06-15T08:30:00.000Z'), 'fr')).toBe(chaine)
  })

  it('rend une chaîne vide plutôt qu’« Invalid Date »', () => {
    // Une carte affiche ce qu'on lui donne : « Invalid Date » au milieu d'une annonce serait pire
    // qu'une ligne vide, et c'est déjà le parti pris de `formatDate`.
    expect(formatCarpoolDate('pas une date', 'fr')).toBe('')
    expect(formatCarpoolDate(null, 'fr')).toBe('')
    expect(formatCarpoolDate(undefined, 'fr')).toBe('')
    expect(formatCarpoolDate('', 'fr')).toBe('')
  })
})
