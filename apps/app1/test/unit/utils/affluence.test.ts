import { describe, expect, it } from 'vitest'

import {
  compterAffluence,
  estPresenteDansLaTranche,
  presenceEffective,
  reunirLesTitres,
  sommetDeLAffluence,
  tranchesDepuisBornes,
  type PersonnePresente,
  type PresenceDeclaree,
} from '../../../shared/utils/affluence'

/**
 * L'affluence : combien de PERSONNES sont sur place, quand, et à quel titre.
 *
 * Le graphique voisin compte des arrivées — un flux. Celui-ci compte un stock, et un stock faux
 * reste un nombre parfaitement plausible : personne ne verra jamais à l'œil qu'une courbe annonce
 * 274 présents au lieu de 191.
 *
 * Trois choses se jouent ici, et chacune a sa mesure dans la base de développement :
 *
 * - **le recouvrement** plutôt que l'instant d'ouverture de la tranche. Compter « présent à minuit »
 *   exclurait de la journée du samedi tous ceux qui arrivent le samedi matin ;
 * - **le rapprochement des personnes**. Sur l'édition 1, 274 entrées pour 191 personnes : compter les
 *   entrées surévalue l'affluence de 30 % ;
 * - **l'attribution à une population**. 10 personnes sur 191 portent deux titres — 8 billet +
 *   bénévole, 2 billet + artiste. Les quatre piles doivent s'additionner au total, sans quoi
 *   l'échelle du graphique mentirait.
 */

const H = 3_600_000
const JOUR = 24 * H

/** Vendredi 0 h comme origine, pour que les calculs se lisent en heures. */
const T0 = Date.UTC(2026, 6, 10, 0, 0, 0)

const titre = (over: Partial<PresenceDeclaree> = {}): PresenceDeclaree => ({
  identite: 'courriel:a@b.test',
  population: 'participants',
  entree: T0 + 10 * H,
  fenetre: { arrivee: null, depart: null },
  // Par défaut le régime du participant : le scan EST la porte.
  laValidationFaitLArrivee: true,
  ...over,
})

const personne = (over: Partial<PersonnePresente> = {}): PersonnePresente => ({
  identite: 'courriel:a@b.test',
  population: 'participants',
  debut: T0 + 10 * H,
  fin: null,
  ...over,
})

const tranche = (debutHeures: number, dureeHeures: number) => ({
  debut: T0 + debutHeures * H,
  fin: T0 + (debutHeures + dureeHeures) * H,
})

/**
 * Des bornes régulières, pour la commodité de ces tests.
 *
 * En production c'est l'endpoint qui les fabrique, avec Luxon et le fuseau de l'édition : un pas
 * fixe dériverait d'une heure au changement d'heure.
 */
const bornesRegulieres = (debut: number, fin: number, minutes: number) => {
  const bornes: number[] = []
  for (let t = debut; t <= fin; t += minutes * 60_000) bornes.push(t)
  return bornes
}
const decouper = (debut: number, fin: number, minutes: number) =>
  tranchesDepuisBornes(bornesRegulieres(debut, fin, minutes))

describe('presenceEffective', () => {
  it('part de l’entrée validée quand rien n’est déclaré', () => {
    expect(presenceEffective(titre({ entree: T0 + 10 * H }))).toEqual({
      debut: T0 + 10 * H,
      fin: null,
    })
  })

  it('retient la date du tarif quand le billet a été validé AVANT elle', () => {
    /*
     * La règle telle que l'utilisateur l'a énoncée : « s'il a validé le billet avant même que le
     * tarif ne commence, il faut prendre la date où le tarif commence ». Le cas réel est la
     * validation au guichet la veille de l'ouverture.
     */
    const t = titre({ entree: T0, fenetre: { arrivee: T0 + 20 * H, depart: null } })

    expect(presenceEffective(t).debut).toBe(T0 + 20 * H)
  })

  it('retient la validation quand elle est postérieure au début du tarif', () => {
    // L'autre sens : un tarif qui annonce vendredi, une entrée validée samedi. Retenir le tarif
    // ferait compter quelqu'un avant qu'il ne soit là, sur la seule foi d'un paramétrage.
    const t = titre({ entree: T0 + 30 * H, fenetre: { arrivee: T0, depart: null } })

    expect(presenceEffective(t).debut).toBe(T0 + 30 * H)
  })

  it('prend la fin de la fenêtre, jamais celle de l’entrée', () => {
    expect(presenceEffective(titre({ fenetre: { arrivee: null, depart: T0 + 60 * H } })).fin).toBe(
      T0 + 60 * H
    )
  })
})

describe('presenceEffective — quand la validation ne fait PAS foi', () => {
  /**
   * Le régime des bénévoles, artistes et organisateurs QUI ONT DÉCLARÉ leur date.
   *
   * Leur badge se fait valider quand ils y pensent, parfois le dernier jour de l'édition, pour le
   * comptage. Mesuré sur la base de développement : 51 bénévoles sur 85 valident au moins un jour
   * après leur arrivée déclarée, dont 22 trois ou quatre jours après. Prendre le plus tardif des
   * deux les faisait apparaître au dernier jour alors qu'ils étaient là depuis le début.
   *
   * Pour un participant, en revanche, le scan EST la porte : il ne peut pas être là sans elle, et son
   * régime ne change pas.
   */
  it('retient la date déclarée, même validée quatre jours plus tard', () => {
    const benevole = titre({
      population: 'benevoles',
      entree: T0 + 4 * JOUR,
      fenetre: { arrivee: T0, depart: T0 + 5 * JOUR },
      laValidationFaitLArrivee: false,
    })

    expect(presenceEffective(benevole).debut).toBe(T0)
  })

  it('retient aussi la date déclarée quand la validation la PRÉCÈDE', () => {
    // Le régime ne consiste pas à prendre le plus précoce : c'est la déclaration qui fait foi, dans
    // les deux sens. Compter quelqu'un avant sa propre déclaration serait aussi faux.
    const benevole = titre({
      population: 'benevoles',
      entree: T0,
      fenetre: { arrivee: T0 + JOUR, depart: null },
      laValidationFaitLArrivee: false,
    })

    expect(presenceEffective(benevole).debut).toBe(T0 + JOUR)
  })

  it('revient à la validation quand rien n’est déclaré', () => {
    /*
     * La nuance qui fait la justesse du correctif. Sans déclaration, il ne reste qu'un repli — une
     * case « disponible pendant l'événement » — et s'en contenter compterait ce bénévole présent dès
     * l'ouverture sur une donnée plus vague que sa validation.
     *
     * L'appelant pose alors le drapeau à vrai, et le régime du participant s'applique.
     */
    const sansDeclaration = titre({
      population: 'benevoles',
      entree: T0 + 2 * JOUR,
      fenetre: { arrivee: T0, depart: null },
      laValidationFaitLArrivee: true,
    })

    expect(presenceEffective(sansDeclaration).debut).toBe(T0 + 2 * JOUR)
  })

  it('ne change rien pour un participant', () => {
    // La règle de l'utilisateur pour les participants reste intacte : le plus tardif des deux.
    const participant = titre({
      population: 'participants',
      entree: T0 + 2 * JOUR,
      fenetre: { arrivee: T0, depart: null },
      laValidationFaitLArrivee: true,
    })

    expect(presenceEffective(participant).debut).toBe(T0 + 2 * JOUR)
  })

  it('laisse la fin inchangée, quel que soit le régime', () => {
    // Le régime ne porte que sur l'ARRIVÉE : la fin vient toujours de la fenêtre déclarée, puisque
    // rien n'enregistre les départs.
    for (const faitFoi of [true, false]) {
      const t = titre({
        entree: T0,
        fenetre: { arrivee: T0, depart: T0 + 3 * JOUR },
        laValidationFaitLArrivee: faitFoi,
      })
      expect(presenceEffective(t).fin).toBe(T0 + 3 * JOUR)
    }
  })
})

describe('reunirLesTitres', () => {
  it('ne fait qu’une personne de deux titres', () => {
    const personnes = reunirLesTitres([
      titre({ identite: 'courriel:x@y.test', population: 'benevoles' }),
      titre({ identite: 'courriel:x@y.test', population: 'participants' }),
    ])

    expect(personnes).toHaveLength(1)
  })

  it('retient la population la plus engagée', () => {
    // Choix de l'utilisateur : « le rôle engagé d'abord ». Quelqu'un qui a un billet ET tient des
    // créneaux est sur place comme bénévole.
    const personnes = reunirLesTitres([
      titre({ identite: 'courriel:x@y.test', population: 'participants' }),
      titre({ identite: 'courriel:x@y.test', population: 'benevoles' }),
    ])

    expect(personnes[0]!.population).toBe('benevoles')
  })

  it('applique la priorité dans les deux sens de déclaration', () => {
    // L'ordre dans lequel les titres arrivent ne doit rien changer : sinon la population dépendrait
    // de l'ordre des requêtes.
    for (const ordre of [
      ['organisateurs', 'artistes'],
      ['artistes', 'organisateurs'],
    ] as const) {
      const personnes = reunirLesTitres(
        ordre.map((population) => titre({ identite: 'courriel:x@y.test', population }))
      )
      expect(personnes[0]!.population).toBe('organisateurs')
    }
  })

  it('respecte l’ordre complet organisateur, artiste, bénévole, participant', () => {
    const personnes = reunirLesTitres([
      titre({ identite: 'courriel:x@y.test', population: 'participants' }),
      titre({ identite: 'courriel:x@y.test', population: 'benevoles' }),
      titre({ identite: 'courriel:x@y.test', population: 'artistes' }),
      titre({ identite: 'courriel:x@y.test', population: 'organisateurs' }),
    ])

    expect(personnes[0]!.population).toBe('organisateurs')
  })

  it('réunit les fenêtres plutôt que de garder celle du titre gagnant', () => {
    /*
     * La règle la moins évidente, et celle qui compte le plus.
     *
     * Un bénévole qui a aussi un pass week-end est sur place tant que l'un des deux titres le dit.
     * Ne garder que la fenêtre du titre gagnant le ferait disparaître du vendredi parce qu'il ne
     * tient de créneau que le samedi — alors qu'il est bien là, et qu'il y est comme bénévole.
     */
    const personnes = reunirLesTitres([
      titre({
        identite: 'courriel:x@y.test',
        population: 'benevoles',
        entree: T0 + JOUR,
        fenetre: { arrivee: T0 + JOUR, depart: T0 + JOUR + 12 * H },
      }),
      titre({
        identite: 'courriel:x@y.test',
        population: 'participants',
        entree: T0,
        fenetre: { arrivee: T0, depart: T0 + 3 * JOUR },
      }),
    ])

    expect(personnes[0]).toMatchObject({
      population: 'benevoles',
      debut: T0,
      fin: T0 + 3 * JOUR,
    })
  })

  it('une fenêtre sans fin emporte l’union', () => {
    // `null` ne se referme pas : réunir une fenêtre bornée et une fenêtre ouverte donne une fenêtre
    // ouverte, sans quoi on inventerait un départ.
    const personnes = reunirLesTitres([
      titre({ identite: 'courriel:x@y.test', fenetre: { arrivee: null, depart: T0 + JOUR } }),
      titre({ identite: 'courriel:x@y.test', fenetre: { arrivee: null, depart: null } }),
    ])

    expect(personnes[0]!.fin).toBeNull()
  })

  it('garde deux personnes distinctes séparées', () => {
    const personnes = reunirLesTitres([
      titre({ identite: 'courriel:x@y.test' }),
      titre({ identite: 'courriel:z@y.test' }),
    ])

    expect(personnes).toHaveLength(2)
  })

  it('ne rend rien sans titre', () => {
    expect(reunirLesTitres([])).toEqual([])
  })
})

describe('estPresenteDansLaTranche', () => {
  it('compte quelqu’un arrivé au milieu de la tranche', () => {
    // LE point du recouvrement. Arrivé samedi 10 h, il est présent « ce samedi », même si la tranche
    // d'un jour commence à minuit.
    expect(estPresenteDansLaTranche(personne({ debut: T0 + 10 * H }), tranche(0, 24))).toBe(true)
  })

  it('ne le compte pas dans une tranche entièrement antérieure à son arrivée', () => {
    expect(estPresenteDansLaTranche(personne({ debut: T0 + 30 * H }), tranche(0, 24))).toBe(false)
  })

  it('ne le compte plus après son départ', () => {
    const p = personne({ debut: T0, fin: T0 + 20 * H })

    expect(estPresenteDansLaTranche(p, tranche(0, 12))).toBe(true)
    expect(estPresenteDansLaTranche(p, tranche(24, 12))).toBe(false)
  })

  it('le compte encore dans la tranche où il repart', () => {
    // Il était bien là une partie de cette tranche : l'en exclure ferait disparaître le dernier jour
    // de tout le monde.
    expect(
      estPresenteDansLaTranche(personne({ debut: T0, fin: T0 + 30 * H }), tranche(24, 24))
    ).toBe(true)
  })

  it('ne le compte pas quand il repart à l’instant même où la tranche commence', () => {
    // Borne de fin EXCLUE : sans cela, un départ à minuit pile ajouterait une journée entière de
    // présence à tous ceux qui partent la veille au soir.
    const p = personne({ debut: T0, fin: T0 + 24 * H })

    expect(estPresenteDansLaTranche(p, tranche(24, 24))).toBe(false)
    expect(estPresenteDansLaTranche(p, tranche(0, 24))).toBe(true)
  })

  it('reste présent indéfiniment sans fin déclarée', () => {
    expect(estPresenteDansLaTranche(personne({ debut: T0 }), tranche(240, 24))).toBe(true)
  })
})

describe('tranchesDepuisBornes', () => {
  it('découpe une journée en tranches de vingt minutes', () => {
    const tranches = decouper(T0, T0 + JOUR, 20)

    expect(tranches).toHaveLength(72)
    expect(tranches[0]).toEqual({ debut: T0, fin: T0 + 20 * 60_000 })
  })

  it('couvre les cinq granularités demandées', () => {
    // 1 jour, 12 h, 6 h, 1 h, 20 min sur trois jours.
    const attendu = { 1440: 3, 720: 6, 360: 12, 60: 72, 20: 216 }

    for (const [minutes, nombre] of Object.entries(attendu)) {
      expect(decouper(T0, T0 + 3 * JOUR, Number(minutes))).toHaveLength(nombre)
    }
  })

  it('ignore une borne qui ne progresse pas', () => {
    // Une tranche de largeur nulle ferait une case dans laquelle personne ne serait jamais compté.
    expect(tranchesDepuisBornes([T0, T0, T0 + JOUR])).toEqual([{ debut: T0, fin: T0 + JOUR }])
  })

  it('ne délimite rien avec une seule borne', () => {
    expect(tranchesDepuisBornes([T0])).toEqual([])
    expect(tranchesDepuisBornes([])).toEqual([])
  })
})

describe('compterAffluence', () => {
  it('répartit les présents dans les quatre piles', () => {
    const tranches = decouper(T0, T0 + JOUR, 1440)
    const gens = [
      personne({ identite: 'a', population: 'participants' }),
      personne({ identite: 'b', population: 'participants' }),
      personne({ identite: 'c', population: 'benevoles' }),
      personne({ identite: 'd', population: 'artistes' }),
      personne({ identite: 'e', population: 'organisateurs' }),
    ]

    const { total, parPopulation } = compterAffluence(gens, tranches)

    expect(parPopulation.participants).toEqual([2])
    expect(parPopulation.benevoles).toEqual([1])
    expect(parPopulation.artistes).toEqual([1])
    expect(parPopulation.organisateurs).toEqual([1])
    expect(total).toEqual([5])
  })

  it('les quatre piles s’additionnent EXACTEMENT au total', () => {
    /*
     * Ce qui autorise à les empiler. Une répartition où quelqu'un compterait deux fois ferait une
     * pile plus haute que le nombre de gens sur le site, et l'échelle du graphique mentirait.
     */
    const tranches = decouper(T0, T0 + 3 * JOUR, 360)
    const gens = [
      personne({ identite: 'a', population: 'participants', fin: T0 + JOUR }),
      personne({ identite: 'b', population: 'benevoles', debut: T0 + 12 * H }),
      personne({ identite: 'c', population: 'artistes', debut: T0 + JOUR, fin: T0 + 2 * JOUR }),
      personne({ identite: 'd', population: 'organisateurs' }),
    ]

    const { total, parPopulation } = compterAffluence(gens, tranches)

    total.forEach((somme, i) => {
      const empilees =
        parPopulation.participants[i]! +
        parPopulation.benevoles[i]! +
        parPopulation.artistes[i]! +
        parPopulation.organisateurs[i]!
      expect(empilees, `tranche ${i}`).toBe(somme)
    })
  })

  it('dessine une courbe qui monte puis redescend', () => {
    /*
     * Ce que tout le dispositif cherche à obtenir. Sans fenêtre de fin, aucune sortie n'étant
     * enregistrée, cette courbe ne pourrait que croître.
     */
    const tranches = decouper(T0, T0 + 3 * JOUR, 1440)
    const gens = [
      personne({ identite: 'a', debut: T0, fin: T0 + 3 * JOUR }),
      personne({ identite: 'b', debut: T0, fin: T0 + JOUR }),
      personne({ identite: 'c', debut: T0 + 2 * JOUR + 10 * H, fin: T0 + 3 * JOUR }),
    ]

    expect(compterAffluence(gens, tranches).total).toEqual([2, 1, 2])
  })

  it('rend des zéros partout sur une édition où personne n’est entré', () => {
    const tranches = decouper(T0, T0 + 2 * JOUR, 1440)
    const { total, parPopulation } = compterAffluence([], tranches)

    expect(total).toEqual([0, 0])
    expect(parPopulation.benevoles).toEqual([0, 0])
  })

  it('rend les quatre séries même vides, pour que le graphique ait ses piles', () => {
    const { parPopulation } = compterAffluence([], [])

    expect(Object.keys(parPopulation).sort()).toEqual([
      'artistes',
      'benevoles',
      'organisateurs',
      'participants',
    ])
  })
})

describe('sommetDeLAffluence', () => {
  it('trouve le maximum et l’instant où il se produit', () => {
    const tranches = decouper(T0, T0 + 3 * JOUR, 1440)

    expect(sommetDeLAffluence([2, 9, 4], tranches)).toEqual({ valeur: 9, debut: T0 + JOUR })
  })

  it('retient le PREMIER sommet en cas d’égalité', () => {
    // Arbitraire mais fixé : « le plus fort a eu lieu à » doit désigner un instant, et le premier est
    // celui qu'on cherche quand on veut savoir quand la pression est montée.
    const tranches = decouper(T0, T0 + 3 * JOUR, 1440)

    expect(sommetDeLAffluence([5, 5, 1], tranches).debut).toBe(T0)
  })

  it('rend zéro et aucun instant sur une courbe plate à zéro', () => {
    const tranches = decouper(T0, T0 + 2 * JOUR, 1440)

    expect(sommetDeLAffluence([0, 0], tranches)).toEqual({ valeur: 0, debut: null })
  })
})
