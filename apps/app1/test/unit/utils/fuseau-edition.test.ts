import { describe, expect, it } from 'vitest'

import {
  abreviationFuseau,
  differeDuFuseauLecteur,
  formaterHeure,
  formaterJournee,
  journeeDans,
  versChampLocal,
  versInstant,
} from '../../../shared/utils/fuseau-edition'

/**
 * Les fuseaux sont nommés explicitement dans chaque cas : un test qui s'appuierait sur celui de la
 * machine passerait chez son auteur et échouerait en intégration, où le conteneur tourne en UTC.
 * C'est exactement le glissement qui avait laissé passer le décalage que ce module corrige.
 */
describe('versInstant', () => {
  it('ancre une heure sans fuseau dans celui de l’édition', () => {
    expect(versInstant('2026-08-01T12:00', 'Europe/Paris')).toBe('2026-08-01T10:00:00.000Z')
    expect(versInstant('2026-08-01T12:00', 'Australia/Melbourne')).toBe('2026-08-01T02:00:00.000Z')
  })

  // L'heure d'hiver et l'heure d'été ne donnent pas le même décalage pour un même fuseau.
  it('suit le changement d’heure', () => {
    expect(versInstant('2026-01-15T12:00', 'Europe/Paris')).toBe('2026-01-15T11:00:00.000Z')
    expect(versInstant('2026-07-15T12:00', 'Europe/Paris')).toBe('2026-07-15T10:00:00.000Z')
  })

  /**
   * Un fuseau absent ne doit pas empêcher d'enregistrer : la plupart des éditions n'en déclarent
   * pas encore, et les refuser rendrait le programme inutilisable pour elles.
   */
  it('retombe sur la machine quand aucun fuseau n’est déclaré', () => {
    for (const fuseau of [null, undefined, '']) {
      const relu = new Date(versInstant('2026-08-01T12:00', fuseau))
      expect(relu.getHours(), String(fuseau)).toBe(12)
    }
  })

  /**
   * Un fuseau annoncé mais inconnu est un autre cas : l'appelant croit tenir celui de la
   * convention. Retomber sur la machine enregistrerait un instant faux sans que rien ne le dise,
   * et une donnée fausse en base survit bien plus longtemps qu'un affichage approximatif.
   */
  it('refuse d’écrire sous un fuseau qui n’existe pas', () => {
    expect(versInstant('2026-08-01T12:00', 'Mars/Olympus')).toBe('')
  })

  it('rend une chaîne vide plutôt qu’un instant inventé', () => {
    expect(versInstant('', 'Europe/Paris')).toBe('')
    expect(versInstant('pas une heure', 'Europe/Paris')).toBe('')
  })

  /**
   * Les deux nuits par an où une heure locale est ambiguë. Le comportement est celui de luxon, et
   * il est fixé ici parce qu'il est contre-intuitif : une heure qui n'existe pas n'est pas
   * refusée, elle est reportée après le saut. Un créneau annoncé cette nuit-là existe bel et bien
   * sur le site de l'organisateur ; le refuser perdrait le programme d'une soirée entière.
   */
  it('reporte une heure inexistante, et retient la première des heures doublées', () => {
    // 29 mars 2026 : 2 h devient 3 h. 2 h 30 n'existe pas, et devient 3 h 30 sur place.
    expect(versInstant('2026-03-29T02:30', 'Europe/Paris')).toBe('2026-03-29T01:30:00.000Z')
    // 25 octobre 2026 : 2 h 30 survient deux fois. La première, encore en heure d'été, l'emporte.
    expect(versInstant('2026-10-25T02:30', 'Europe/Paris')).toBe('2026-10-25T00:30:00.000Z')
  })
})

describe('versChampLocal', () => {
  /**
   * Aller-retour : rouvrir une modale puis enregistrer sans rien toucher ne doit pas déplacer
   * l'horaire. C'est le défaut le plus insidieux, puisqu'il décale d'un cran à chaque passage.
   */
  it('rend au formulaire l’heure qui y avait été saisie', () => {
    const instant = versInstant('2026-08-01T21:30', 'Europe/Paris')
    expect(versChampLocal(instant, 'Europe/Paris')).toBe('2026-08-01T21:30')
  })

  it('affiche l’heure sur place, et non celle du lecteur', () => {
    expect(versChampLocal('2026-08-01T10:00:00.000Z', 'Australia/Melbourne')).toBe(
      '2026-08-01T20:00'
    )
  })
})

describe('journeeDans', () => {
  /**
   * Une soirée qui commence à 23 h appartient à la journée où le public la vit. Découpée dans un
   * autre fuseau, elle basculerait au lendemain et la frise compterait un jour de trop.
   */
  it('rattache une fin de soirée à la journée vécue sur place', () => {
    const instant = versInstant('2026-08-01T23:00', 'Europe/Paris')
    expect(journeeDans(instant, 'Europe/Paris')).toBe('2026-08-01')
    // Le même instant, lu depuis Melbourne, tombe le lendemain : c'est ce que le fuseau évite.
    expect(journeeDans(instant, 'Australia/Melbourne')).toBe('2026-08-02')
  })
})

describe('formaterJournee', () => {
  /**
   * Le piège que cette fonction existe pour éviter : `new Date('2026-08-01')` désigne minuit **en
   * temps universel**, et s'affichait donc au 31 juillet pour un lecteur à l'ouest de Greenwich —
   * l'entête d'une journée de frise annonçait la veille.
   */
  it('ne déplace pas une journée nue', () => {
    expect(formaterJournee('2026-08-01', 'Europe/Paris')).toBe('samedi 1 août 2026')
    // Le fuseau ne doit rien y changer : une journée nue ne désigne aucun instant.
    expect(formaterJournee('2026-08-01', 'Pacific/Honolulu')).toBe('samedi 1 août 2026')
  })

  // Un instant, lui, se date bien dans le fuseau de l'édition.
  it('date un instant sur place', () => {
    expect(formaterJournee('2026-08-01T23:00:00.000Z', 'Europe/Paris')).toBe('dimanche 2 août 2026')
    expect(formaterJournee('2026-08-01T23:00:00.000Z', 'UTC')).toBe('samedi 1 août 2026')
  })
})

describe('formaterHeure', () => {
  it('affiche l’heure de la convention', () => {
    expect(formaterHeure('2026-08-01T10:00:00.000Z', 'Europe/Paris')).toBe('12:00')
    expect(formaterHeure('2026-08-01T10:00:00.000Z', 'Australia/Melbourne')).toBe('20:00')
  })
})

describe('abreviationFuseau', () => {
  it('dépend de la date, puisque l’heure d’été la fait changer', () => {
    expect(abreviationFuseau('2026-07-15T10:00:00.000Z', 'Europe/Paris')).toBe('UTC+2')
    expect(abreviationFuseau('2026-01-15T10:00:00.000Z', 'Europe/Paris')).toBe('UTC+1')
  })

  it('ne dit rien quand l’édition ne déclare pas de fuseau', () => {
    expect(abreviationFuseau('2026-07-15T10:00:00.000Z', null)).toBe('')
  })
})

describe('differeDuFuseauLecteur', () => {
  /**
   * L'avertissement porte sur le décalage, pas sur le nom du fuseau : `Europe/Paris` et
   * `Europe/Amsterdam` sont deux noms de la même heure, et prévenir n'aurait alors aucun sens.
   */
  it('ignore deux noms d’un même décalage', () => {
    expect(differeDuFuseauLecteur('2026-08-01T10:00:00.000Z', 'Europe/Amsterdam')).toBe(
      differeDuFuseauLecteur('2026-08-01T10:00:00.000Z', 'Europe/Paris')
    )
  })

  it('ne prévient de rien sans fuseau déclaré', () => {
    expect(differeDuFuseauLecteur('2026-08-01T10:00:00.000Z', null)).toBe(false)
  })
})
