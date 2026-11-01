import { describe, it, expect } from 'vitest'

import { cleDeRapprochementJugglingEdge } from '../../../server/utils/jugglingedge-scraper'

/**
 * Le rapprochement d'une URL JugglingEdge avec celle d'une édition déjà importée.
 *
 * ## ⚠️ LE DÉFAUT QUE CES CAS EMPÊCHENT, et il aurait été invisible
 *
 * MESURÉ le 1er novembre 2026 sur les onze éditions déjà importées depuis JugglingEdge : elles
 * stockent leur URL d'origine sur DEUX hôtes —
 *
 *     https://www.jugglingedge.com/event.php?EventID=6485   ← la majorité
 *     https://fr.jugglingedge.com/event.php?EventID=6447    ← au moins deux
 *
 * — tandis que l'énumération de l'agenda canonicalise sur `https://jugglingedge.com/…`, sans
 * sous-domaine. **Trois écritures pour le même événement.**
 *
 * Une comparaison de chaînes n'en apparierait AUCUNE. Le calcul « déjà importé » ne trouverait
 * jamais rien, et l'écran de veille reproposerait indéfiniment les onze conventions déjà en base —
 * sans qu'aucune erreur ne soit levée, sans qu'aucun test ne tombe. Le genre de défaut qui se
 * découvre six mois plus tard, en se demandant pourquoi la liste ne désenfle pas.
 *
 * ## Le sens dangereux
 *
 * Un faux appariement est PIRE qu'un appariement manqué : il ferait passer pour importé un
 * événement qui ne l'est pas, et le candidat disparaîtrait de l'écran. D'où les cas négatifs
 * ci-dessous, aussi nombreux que les positifs.
 */
describe('cleDeRapprochementJugglingEdge', () => {
  it('⚠️ les TROIS écritures d’un même événement donnent la même clé', () => {
    /*
     * Le cas qui porte tout le reste, et dont les valeurs viennent des données réelles.
     */
    const cles = [
      'https://jugglingedge.com/event.php?EventID=6485',
      'https://www.jugglingedge.com/event.php?EventID=6485',
      'https://fr.jugglingedge.com/event.php?EventID=6485',
    ].map(cleDeRapprochementJugglingEdge)

    expect(cles).toEqual(['jugglingedge:6485', 'jugglingedge:6485', 'jugglingedge:6485'])
  })

  it('distingue deux événements différents', () => {
    // Sans ce cas, une fonction qui rendrait une constante passerait le précédent.
    expect(
      cleDeRapprochementJugglingEdge('https://jugglingedge.com/event.php?EventID=6485')
    ).not.toBe(cleDeRapprochementJugglingEdge('https://jugglingedge.com/event.php?EventID=6486'))
  })

  it('ignore la casse du nom du paramètre, et les paramètres surnuméraires', () => {
    /*
     * L'agenda écrit `EventID`, mais rien ne garantit la graphie d'une URL collée à la main dans le
     * formulaire d'import — et un lien partagé traîne souvent des paramètres de suivi.
     */
    expect(cleDeRapprochementJugglingEdge('https://jugglingedge.com/event.php?eventid=6485')).toBe(
      'jugglingedge:6485'
    )
    expect(
      cleDeRapprochementJugglingEdge(
        'https://www.jugglingedge.com/event.php?utm_source=x&EventID=6485&ref=y'
      )
    ).toBe('jugglingedge:6485')
  })

  describe('⚠️ rend null plutôt que d’apparier à tort', () => {
    it('sur un autre domaine, même s’il contient le mot', () => {
      /*
       * `jugglingedge.com.exemple.net` est un autre site : l'ancre de l'expression régulière doit
       * tenir sur la FIN du nom d'hôte, sans quoi un domaine contrôlé par un tiers serait pris pour
       * la source.
       */
      for (const url of [
        'https://facebook.com/events/123',
        'https://jugglingedge.com.exemple.net/event.php?EventID=6485',
        'https://notjugglingedge.com/event.php?EventID=6485',
      ]) {
        expect(cleDeRapprochementJugglingEdge(url), url).toBeNull()
      }
    })

    it('sur une page JugglingEdge qui n’est pas un événement', () => {
      for (const url of [
        'https://jugglingedge.com/events.php',
        'https://jugglingedge.com/clublistings.php?EventID=6485',
        'https://jugglingedge.com/',
      ]) {
        expect(cleDeRapprochementJugglingEdge(url), url).toBeNull()
      }
    })

    it('sur un événement sans identifiant, ou vide', () => {
      for (const url of [
        'https://jugglingedge.com/event.php',
        'https://jugglingedge.com/event.php?EventID=',
        'https://jugglingedge.com/event.php?EventID=%20',
      ]) {
        expect(cleDeRapprochementJugglingEdge(url), url).toBeNull()
      }
    })

    it('sur une chaîne qui n’est pas une URL, sans lever', () => {
      for (const brut of ['', 'pas une url', 'event.php?EventID=6485', 'javascript:alert(1)']) {
        expect(cleDeRapprochementJugglingEdge(brut), brut).toBeNull()
      }
    })
  })
})
