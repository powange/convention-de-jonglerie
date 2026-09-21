import { describe, expect, it } from 'vitest'

import { estUneDateDeValiditeLisible, instantDeValidite } from '../../../shared/utils/date-validite'

/**
 * Deux défauts se répondent ici, et le second est né de la correction du premier.
 *
 * 1. Le serveur lisait l'heure de validité d'un tarif avec `z.coerce.date()`. Une chaîne sans
 *    fuseau est interprétée dans celui du processus — UTC en conteneur. « 23:00 » devenait 23 h
 *    UTC, soit 1 h du matin à Paris : le tarif expirait deux heures trop tard.
 *
 * 2. En exigeant un instant daté pour corriger le premier, on a cassé toutes les pages ouvertes
 *    AVANT le déploiement : leur sélecteur envoyait encore l'heure murale nue, et l'API la
 *    refusait sur un « Invalid ISO datetime » incompréhensible. Signalé par un organisateur.
 *
 * Les deux formes sont donc acceptées, et **toutes deux ancrées sur le fuseau de l'édition**.
 */

const PARIS = 'Europe/Paris'

describe('instantDeValidite', () => {
  it('ancre une heure murale nue sur le fuseau de l’édition', () => {
    // Le cas exact du signalement : 23 h le 1er octobre, saisi pour une convention française.
    // Le 1er octobre est encore en heure d'été (+02:00), d'où 21 h UTC.
    expect(instantDeValidite('2026-10-01T23:00', PARIS)?.toISOString()).toBe(
      '2026-10-01T21:00:00.000Z'
    )
  })

  it('ne lit PAS une heure nue comme de l’UTC — c’est le défaut d’origine', () => {
    // La ligne qui compte. Si cette attente tombe, le tarif expire deux heures trop tard, et
    // rien d'autre dans le dépôt ne le signalera : la date reste plausible.
    expect(instantDeValidite('2026-10-01T23:00', PARIS)?.toISOString()).not.toBe(
      '2026-10-01T23:00:00.000Z'
    )
  })

  it('suit le changement d’heure plutôt qu’un décalage figé', () => {
    // Le 1er novembre, Paris est repassé à +01:00 : la même heure murale ne rend pas le même
    // instant. Coder « moins deux heures » en dur aurait passé le test précédent et raté celui-ci.
    expect(instantDeValidite('2026-11-01T23:00', PARIS)?.toISOString()).toBe(
      '2026-11-01T22:00:00.000Z'
    )
  })

  it('laisse passer un instant déjà daté, sans le retoucher', () => {
    // Ce qu'envoie le client courant, qui ancre lui-même avant de transmettre.
    expect(instantDeValidite('2026-10-01T21:00:00.000Z', PARIS)?.toISOString()).toBe(
      '2026-10-01T21:00:00.000Z'
    )
    // Un décalage explicite est un instant, lui aussi : il ne doit pas être ré-ancré.
    expect(instantDeValidite('2026-10-01T23:00:00+02:00', PARIS)?.toISOString()).toBe(
      '2026-10-01T21:00:00.000Z'
    )
  })

  it('traite une journée seule comme son minuit sur place', () => {
    expect(instantDeValidite('2026-10-01', PARIS)?.toISOString()).toBe('2026-09-30T22:00:00.000Z')
  })

  it('rend null pour une absence, sous toutes ses formes', () => {
    expect(instantDeValidite(null, PARIS)).toBeNull()
    expect(instantDeValidite(undefined, PARIS)).toBeNull()
    expect(instantDeValidite('', PARIS)).toBeNull()
  })

  it('rend null plutôt qu’une date inventée quand l’ancrage échoue', () => {
    // Un fuseau annoncé mais inconnu : l'appelant croit tenir celui de la convention. Enregistrer
    // l'heure de la machine à la place serait faux sans que rien ne le signale.
    expect(instantDeValidite('2026-10-01T23:00', 'Mars/Olympus_Mons')).toBeNull()
    expect(instantDeValidite('n’importe quoi', PARIS)).toBeNull()
  })

  it('accepte une édition sans fuseau déclaré — le champ reste facultatif', () => {
    // Cas courant et légitime : l'édition n'en déclare pas encore. On retombe sur la machine
    // plutôt que de refuser l'enregistrement.
    expect(instantDeValidite('2026-10-01T23:00', null)).toBeInstanceOf(Date)
  })
})

describe('estUneDateDeValiditeLisible', () => {
  it('accepte les deux formes qu’un client peut envoyer', () => {
    expect(estUneDateDeValiditeLisible('2026-10-01T23:00')).toBe(true)
    expect(estUneDateDeValiditeLisible('2026-10-01T23:00:30')).toBe(true)
    expect(estUneDateDeValiditeLisible('2026-10-01')).toBe(true)
    expect(estUneDateDeValiditeLisible('2026-10-01T21:00:00.000Z')).toBe(true)
    expect(estUneDateDeValiditeLisible('2026-10-01T23:00:00+02:00')).toBe(true)
  })

  it('refuse ce qui ne se lit pas, au lieu de l’effacer en silence', () => {
    // Sans ce refus, une chaîne illisible deviendrait `null` en base : la date de validité
    // disparaîtrait sans message, et le tarif resterait vendable pour toujours.
    expect(estUneDateDeValiditeLisible('n’importe quoi')).toBe(false)
    expect(estUneDateDeValiditeLisible('2026-13-45')).toBe(false)
  })
})
