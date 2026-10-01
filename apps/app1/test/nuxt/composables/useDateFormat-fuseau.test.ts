import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { describe, it, expect } from 'vitest'

import { useDateFormat } from '../../../app/composables/useDateFormat'

/**
 * Le fuseau dans lequel `useDateFormat` lit un instant.
 *
 * ⚠️ `timeZone: 'Europe/Paris'` ÉTAIT CODÉ EN DUR dans treize fonctions de ce composable. Une
 * édition australienne affichait donc ses dates à l'heure de Paris — c'est-à-dire autre chose que
 * ce que son organisateur avait saisi, et autre chose que ce que le public venait lire. Chacune
 * accepte désormais le fuseau de l'édition.
 *
 * ⚠️⚠️ CE COMPOSABLE N'AVAIT AUCUN TEST, avec 122 appels dans le dépôt. C'est ce qui a permis à un
 * fuseau codé en dur d'y vivre treize fois sans que rien ne le signale, et c'est aussi ce qui
 * rendait tout changement de son comportement par défaut invérifiable.
 *
 * 📊 MESURÉ SUR LA BASE DE DÉVELOPPEMENT : 15 éditions déclarent un fuseau autre qu'Europe/Paris,
 * 16 sont à Paris, et 38 n'en déclarent AUCUN. Ce dernier chiffre est la raison du repli éprouvé
 * plus bas.
 */

mockNuxtImport('useI18n', () => () => ({
  locale: { value: 'fr' },
  // Les fonctions de plage composent leur résultat avec `t` : on rend un gabarit lisible plutôt
  // que la clé seule, pour que les assertions portent sur les dates et non sur la traduction.
  t: (cle: string, params?: Record<string, string>) =>
    params ? `${cle}(${Object.values(params).join('|')})` : cle,
}))

/** Le 15 juin 2024 à 23 h UTC : le 16 à Paris (UTC+2) et à Sydney (UTC+10), encore le 15 à Montréal. */
const MINUIT_APPROCHANT = '2024-06-15T23:00:00Z'

describe('useDateFormat et le fuseau de l’édition', () => {
  it('🔬 formatDate lit la date dans le fuseau DEMANDÉ', () => {
    const { formatDate } = useDateFormat()

    expect(formatDate(MINUIT_APPROCHANT, 'Australia/Sydney')).toBe('16/06/2024')
    expect(formatDate(MINUIT_APPROCHANT, 'America/Montreal')).toBe('15/06/2024')
  })

  it('🔬 retombe sur Europe/Paris quand AUCUN fuseau n’est fourni', () => {
    /*
     * ⚠️⚠️ CE REPLI EST UNE DÉCISION, pas un reste de l'ancien code. `fuseauUtilisable(null)` rend
     * `undefined`, ce qui ferait lire la date au fuseau de la MACHINE du lecteur. Or 38 des 69
     * éditions n'en déclarent aucun, et des dizaines d'appels de ce composable affichent autre
     * chose qu'une date d'édition — l'horodatage d'un commentaire, d'une notification. Prendre la
     * machine par défaut aurait changé EN SILENCE ce que voient tous les lecteurs hors de France,
     * sans qu'aucune donnée ait bougé.
     *
     * Conséquence voulue, et que ce test fige : seules les éditions qui DÉCLARENT un fuseau
     * changent d'affichage. Le reste est strictement inchangé.
     */
    const { formatDate, formatDateTime, formatTime } = useDateFormat()

    expect(formatDate(MINUIT_APPROCHANT)).toBe('16/06/2024')
    expect(formatDate(MINUIT_APPROCHANT, null)).toBe('16/06/2024')
    // Un fuseau annoncé mais inconnu ne doit pas ouvrir la porte à la machine non plus.
    expect(formatDate(MINUIT_APPROCHANT, 'Pas/Un_Fuseau')).toBe('16/06/2024')
    expect(formatDateTime(MINUIT_APPROCHANT)).toContain('16/06/2024')
    expect(formatTime(MINUIT_APPROCHANT)).toBe('01:00')
  })

  it('formatDateTime et formatTime suivent le fuseau', () => {
    const { formatDateTime, formatTime } = useDateFormat()

    expect(formatTime(MINUIT_APPROCHANT, 'Australia/Sydney')).toBe('09:00')
    expect(formatDateTime(MINUIT_APPROCHANT, 'Australia/Sydney')).toContain('16/06/2024')
    expect(formatDateTime(MINUIT_APPROCHANT, 'America/Montreal')).toContain('15/06/2024')
  })

  it('les formats longs le suivent aussi', () => {
    // Les treize fonctions passaient par la même constante : il n'y a pas de raison de les
    // éprouver une à une, mais il y en a une de vérifier que le paramètre atteint bien les
    // variantes nommées, qui composent leurs options séparément.
    const { formatDateFull, formatDateShortMonth, formatDateWithWeekday } = useDateFormat()

    expect(formatDateFull(MINUIT_APPROCHANT, 'America/Montreal')).toContain('15')
    expect(formatDateFull(MINUIT_APPROCHANT, 'Australia/Sydney')).toContain('16')
    expect(formatDateShortMonth(MINUIT_APPROCHANT, 'America/Montreal')).toContain('15')
    expect(formatDateWithWeekday(MINUIT_APPROCHANT, 'America/Montreal')).toContain('15/06/2024')
  })

  it('🔬 décide « même jour » SUR PLACE, et non au fuseau du lecteur', () => {
    /*
     * ⚠️ `toDateString()` découpait les journées dans le fuseau de la MACHINE. Du 15 à 23 h au 16
     * à 1 h UTC : à Montréal les deux instants tombent le 15, à Sydney tous deux le 16, et la
     * phrase rendue n'est pas la même — « un seul jour avec deux heures » ou « deux dates ».
     * Lue au fuseau du lecteur, la réponse dépendait de l'endroit où l'on se trouvait.
     */
    const { formatDateTimeRange } = useDateFormat()

    expect(
      formatDateTimeRange(MINUIT_APPROCHANT, '2024-06-16T01:00:00Z', 'Australia/Sydney')
    ).toContain('dates.same_day_with_time')
    expect(
      formatDateTimeRange(MINUIT_APPROCHANT, '2024-06-16T01:00:00Z', 'America/Montreal')
    ).toContain('dates.same_day_with_time')
    // Du 15 au 18 : deux journées distinctes dans n'importe quel fuseau.
    expect(
      formatDateTimeRange(MINUIT_APPROCHANT, '2024-06-18T01:00:00Z', 'Europe/Paris')
    ).toContain('dates.date_range_with_time')
  })

  it('les plages PROPAGENT le fuseau à chacune de leurs dates', () => {
    /*
     * 🔬 Assertion nécessaire et non redondante : `formatDateRange` appelle `formatDate` deux fois.
     * Oublier de lui transmettre le fuseau aurait laissé le test « même jour » ci-dessus au vert
     * tout en affichant deux dates lues à Paris — un résultat à moitié juste, donc faux.
     */
    const { formatDateRange, formatDateRangeCompact } = useDateFormat()

    expect(
      formatDateRange(MINUIT_APPROCHANT, '2024-06-18T01:00:00Z', 'America/Montreal')
    ).toContain('15/06/2024')
    expect(
      formatDateRange(MINUIT_APPROCHANT, '2024-06-18T01:00:00Z', 'Australia/Sydney')
    ).toContain('16/06/2024')
    expect(
      formatDateRangeCompact(MINUIT_APPROCHANT, '2024-06-18T01:00:00Z', 'America/Montreal')
    ).toContain('15/06/2024')
  })
})
