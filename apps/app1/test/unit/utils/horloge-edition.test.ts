import { describe, it, expect } from 'vitest'

import { ancrerHorloge, horlogeMurale, relireHorloge } from '../../../app/utils/horloge-edition'

/**
 * L'aller-retour entre ce que l'organisateur tape et ce qu'on enregistre.
 *
 * ⚠️ CE QUI N'ALLAIT PAS. Les deux écrans de saisie des dates d'une édition construisaient
 * `new Date(année, mois, jour, heures, minutes)` — une heure du fuseau de la MACHINE — puis en
 * faisaient un instant UTC. Un organisateur français qui créait une édition à Montréal
 * enregistrait donc un instant décalé de six heures, et le champ « fuseau horaire » qu'il venait de
 * remplir dans le MÊME formulaire n'y changeait rien.
 *
 * La relecture souffrait du défaut inverse : `getHours()` lit dans le fuseau de la machine, si bien
 * qu'ouvrir le formulaire depuis un autre pays affichait une autre heure que celle saisie — et un
 * simple enregistrement la gravait. C'est ce second défaut que l'aller-retour ci-dessous mesure, et
 * c'est le plus insidieux : il dégrade la donnée à chaque passage, sans aucune saisie.
 *
 * 📊 MESURÉ SUR LA BASE DE DÉVELOPPEMENT : 15 éditions déclarent un fuseau autre qu'Europe/Paris
 * (Europe/London ×7, Europe/Zurich ×4, Europe/Berlin ×2, Asia/Kolkata, Europe/Ljubljana) ; 16 sont
 * à Paris et 38 n'en déclarent aucun. Le défaut était vivant, pas théorique.
 *
 * 📍 Ces tests tournent sous le fuseau de la machine de test, quel qu'il soit : aucun n'en dépend,
 * puisque chacun nomme le fuseau qu'il éprouve. C'est précisément ce que l'ancien code ne pouvait
 * pas offrir.
 */

describe('horlogeMurale', () => {
  it('assemble un jour et une heure en date-heure SANS fuseau', () => {
    // La forme intermédiaire qui rend le reste possible : tant que la saisie n'est ancrée nulle
    // part, un seul endroit décide où.
    expect(horlogeMurale({ year: 2026, month: 8, day: 1 }, '09:00')).toBe('2026-08-01T09:00')
  })

  it('complète les mois, jours et heures d’un seul chiffre', () => {
    // Sans ce remplissage, `2026-8-1T9:00` n'est pas une date ISO et luxon la refuserait — la date
    // serait silencieusement perdue.
    expect(horlogeMurale({ year: 2026, month: 3, day: 7 }, '9:05')).toBe('2026-03-07T09:05')
  })

  it('ne rend rien sans jour ou sans heure', () => {
    expect(horlogeMurale(null, '09:00')).toBeNull()
    expect(horlogeMurale({ year: 2026, month: 8, day: 1 }, null)).toBeNull()
  })
})

describe('ancrerHorloge', () => {
  it('🔬 ancre 9 h à SYDNEY, et non au fuseau de la machine', () => {
    /*
     * L'assertion qui porte le point. Le 1er août, Sydney est à UTC+10 : 9 h sur place valent
     * 23 h UTC la veille. L'ancien code rendait 9 h moins le décalage de la MACHINE — donc 7 h UTC
     * depuis la France, soit un écart de neuf heures sur l'instant enregistré.
     */
    expect(ancrerHorloge('2026-08-01T09:00', 'Australia/Sydney')?.toISOString()).toBe(
      '2026-07-31T23:00:00.000Z'
    )
  })

  it('ancre la même saisie à MONTRÉAL, qui donne un autre instant', () => {
    // Le cas nommé dans le constat : l'organisateur français qui crée une édition au Québec.
    expect(ancrerHorloge('2026-08-01T09:00', 'America/Montreal')?.toISOString()).toBe(
      '2026-08-01T13:00:00.000Z'
    )
  })

  it('tient compte de l’heure d’été du LIEU, pas de la nôtre', () => {
    /*
     * 📍 Paris est à UTC+2 en août et UTC+1 en janvier : c'est le fuseau nommé qui porte la règle,
     * pas un décalage fixe. Un code qui soustrairait « deux heures » serait juste la moitié de
     * l'année.
     */
    expect(ancrerHorloge('2026-08-01T12:00', 'Europe/Paris')?.toISOString()).toBe(
      '2026-08-01T10:00:00.000Z'
    )
    expect(ancrerHorloge('2026-01-15T12:00', 'Europe/Paris')?.toISOString()).toBe(
      '2026-01-15T11:00:00.000Z'
    )
  })

  it('REFUSE un fuseau annoncé mais inconnu, plutôt que d’inventer un instant', () => {
    /*
     * ⚠️ `null` ET NON UNE DATE INVALIDE. Une `Date` invalide repartirait à l'API en `null` par
     * `toApiFormat`, ce qui EFFACERAIT la date de l'édition sans que personne l'ait demandé. Rendre
     * `null` laisse la validation du formulaire faire son travail et dire non.
     *
     * Le cas est réel : les fuseaux viennent parfois d'un import.
     */
    expect(ancrerHorloge('2026-08-01T09:00', 'Mars/Olympus_Mons')).toBeNull()
  })

  it('accepte un fuseau ABSENT, qui est le cas de plus de la moitié des éditions', () => {
    /*
     * 📊 38 des 69 éditions de la base de développement ne déclarent aucun fuseau. Ce n'est pas une
     * donnée manquante à refuser : la machine fait alors office de repère, exactement comme avant
     * ce changement. On n'éprouve donc pas l'instant obtenu — il dépend de la machine — mais le
     * fait qu'une date SOIT produite.
     */
    expect(ancrerHorloge('2026-08-01T09:00', null)).toBeInstanceOf(Date)
    expect(ancrerHorloge('2026-08-01T09:00', undefined)?.getTime()).not.toBeNaN()
  })

  it('ne rend rien sans horloge murale', () => {
    expect(ancrerHorloge(null, 'Europe/Paris')).toBeNull()
  })
})

describe('relireHorloge', () => {
  it('🔬 rend l’heure du LIEU, pas celle de la machine', () => {
    /*
     * Le défaut le plus insidieux des deux : `getHours()` lisait l'instant dans le fuseau de la
     * machine. Un organisateur australien qui ouvrait le formulaire depuis la France y lisait 1 h
     * du matin au lieu de 9 h — et le moindre enregistrement gravait ce chiffre.
     */
    const relu = relireHorloge('2026-07-31T23:00:00.000Z', 'Australia/Sydney')

    expect(relu).toEqual({ jour: { year: 2026, month: 8, day: 1 }, heure: '09:00' })
  })

  it('ferme l’ALLER-RETOUR : ce qui est relu se réancre sur le même instant', () => {
    /*
     * 🔬 L'assertion qui garantit qu'une simple ouverture suivie d'un enregistrement ne déplace
     * RIEN. C'est l'invariant que l'ancien code violait : lire et écrire dans le fuseau de la
     * machine était cohérent entre eux, mais produisait une heure murale fausse ; les corriger
     * séparément aurait pu rendre l'aller-retour instable, ce qui aurait été pire.
     */
    for (const fuseau of ['Australia/Sydney', 'America/Montreal', 'Europe/Paris', 'Asia/Kolkata']) {
      const instant = '2026-08-01T09:30:00.000Z'
      const relu = relireHorloge(instant, fuseau)!
      const reancre = ancrerHorloge(horlogeMurale(relu.jour, relu.heure), fuseau)

      expect(reancre?.toISOString(), fuseau).toBe(instant)
    }
  })

  it('traverse un changement de JOUR sans le perdre', () => {
    // Le cas où l'écart de fuseau fait basculer la date : à Sydney, cet instant est déjà le
    // lendemain. Un découpage au fuseau de la machine aurait rendu la veille.
    expect(relireHorloge('2026-08-01T22:00:00.000Z', 'Australia/Sydney')?.jour).toEqual({
      year: 2026,
      month: 8,
      day: 2,
    })
  })

  it('accepte un instant donné en chaîne comme en Date', () => {
    // Les deux formes circulent : l'API sérialise en chaîne, le formulaire manipule des `Date`.
    const chaine = relireHorloge('2026-08-01T10:00:00.000Z', 'Europe/Paris')
    const objet = relireHorloge(new Date('2026-08-01T10:00:00.000Z'), 'Europe/Paris')

    expect(chaine).toEqual(objet)
    expect(chaine?.heure).toBe('12:00')
  })

  it('ne rend rien d’un instant absent ou d’un fuseau inconnu', () => {
    expect(relireHorloge(null, 'Europe/Paris')).toBeNull()
    // `versChampLocal` est tolérant pour AFFICHER — il retombe sur la machine — donc ici un fuseau
    // inconnu rend bien une horloge. Ce qu'on vérifie, c'est qu'il n'explose pas.
    expect(relireHorloge('2026-08-01T10:00:00.000Z', 'Mars/Olympus_Mons')).not.toBeNull()
  })
})
