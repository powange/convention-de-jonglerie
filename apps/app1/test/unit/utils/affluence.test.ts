import { describe, expect, it } from 'vitest'

import {
  compterAffluence,
  estPresentDansLaTranche,
  presenceEffective,
  sommetDeLAffluence,
  tranchesDepuisBornes,
  type ParticipantPresent,
} from '../../../shared/utils/affluence'

/**
 * L'affluence : combien de PERSONNES sont sur place, et quand.
 *
 * Le graphique voisin compte des arrivées — un flux. Celui-ci compte un stock, et un stock faux
 * reste un nombre parfaitement plausible : personne ne verra jamais à l'œil qu'une courbe annonce
 * 274 présents au lieu de 191.
 *
 * Deux choses se jouent ici, et chacune a sa mesure dans la base de développement :
 *
 * - **le recouvrement** plutôt que l'instant d'ouverture de la tranche. Compter « présent à minuit »
 *   exclurait de la journée du samedi tous ceux qui arrivent le samedi matin ;
 * - **le dédoublonnage**. Sur l'édition 1, 274 entrées distinctes pour ~191 personnes : compter les
 *   entrées surévalue l'affluence de 43 %.
 */

const H = 3_600_000
const JOUR = 24 * H

/** Vendredi 0 h comme origine, pour que les calculs se lisent en heures. */
const T0 = Date.UTC(2026, 6, 10, 0, 0, 0)

const participant = (over: Partial<ParticipantPresent> = {}): ParticipantPresent => ({
  identite: 'compte:1',
  entree: T0 + 10 * H,
  fenetre: { arrivee: null, depart: null },
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
const decouperEnTranches = (debut: number, fin: number, minutes: number) =>
  minutes > 0 ? tranchesDepuisBornes(bornesRegulieres(debut, fin, minutes)) : []

describe('presenceEffective', () => {
  it('part de l’entrée validée quand rien n’est déclaré', () => {
    const p = participant({ entree: T0 + 10 * H })

    expect(presenceEffective(p)).toEqual({ debut: T0 + 10 * H, fin: null })
  })

  it('retient la PLUS TARDIVE de l’entrée et de l’arrivée déclarée', () => {
    /*
     * Le cas qui compte : un billet dont le tarif annonce une présence dès vendredi, mais dont
     * l'entrée n'a été validée que samedi. Retenir la déclaration ferait compter quelqu'un avant
     * qu'il ne soit là — sur la seule foi d'un paramétrage de tarif.
     */
    const p = participant({ entree: T0 + 30 * H, fenetre: { arrivee: T0, depart: null } })

    expect(presenceEffective(p).debut).toBe(T0 + 30 * H)
  })

  it('retient l’arrivée déclarée quand elle est postérieure à l’entrée', () => {
    // L'inverse existe aussi : une entrée validée à l'avance, au guichet, la veille de l'ouverture.
    const p = participant({ entree: T0, fenetre: { arrivee: T0 + 20 * H, depart: null } })

    expect(presenceEffective(p).debut).toBe(T0 + 20 * H)
  })

  it('prend la fin de la fenêtre, jamais celle de l’entrée', () => {
    const p = participant({ fenetre: { arrivee: null, depart: T0 + 60 * H } })

    expect(presenceEffective(p).fin).toBe(T0 + 60 * H)
  })
})

describe('estPresentDansLaTranche', () => {
  it('compte quelqu’un arrivé au milieu de la tranche', () => {
    // LE point du recouvrement. Arrivé samedi 10 h, il est présent « ce samedi », même si la tranche
    // d'un jour commence à minuit.
    const p = participant({ entree: T0 + 10 * H })

    expect(estPresentDansLaTranche(p, tranche(0, 24))).toBe(true)
  })

  it('ne le compte pas dans une tranche entièrement antérieure à son arrivée', () => {
    const p = participant({ entree: T0 + 30 * H })

    expect(estPresentDansLaTranche(p, tranche(0, 24))).toBe(false)
  })

  it('ne le compte plus après son départ', () => {
    const p = participant({ entree: T0, fenetre: { arrivee: null, depart: T0 + 20 * H } })

    expect(estPresentDansLaTranche(p, tranche(0, 12))).toBe(true)
    expect(estPresentDansLaTranche(p, tranche(24, 12))).toBe(false)
  })

  it('le compte encore dans la tranche où il repart', () => {
    // Il était bien là une partie de cette tranche : l'en exclure ferait disparaître le dernier
    // jour de tout le monde.
    const p = participant({ entree: T0, fenetre: { arrivee: null, depart: T0 + 30 * H } })

    expect(estPresentDansLaTranche(p, tranche(24, 24))).toBe(true)
  })

  it('ne le compte pas quand il repart à l’instant même où la tranche commence', () => {
    // Borne de fin EXCLUE : sans cela, un départ à minuit pile ajouterait une journée entière de
    // présence à tous ceux qui partent la veille au soir.
    const p = participant({ entree: T0, fenetre: { arrivee: null, depart: T0 + 24 * H } })

    expect(estPresentDansLaTranche(p, tranche(24, 24))).toBe(false)
    expect(estPresentDansLaTranche(p, tranche(0, 24))).toBe(true)
  })

  it('reste présent indéfiniment sans fin déclarée', () => {
    // C'est le comportement d'avant les fenêtres, et celui d'une donnée non renseignée : l'appelant
    // est censé avoir posé un repli, mais cet util ne doit pas inventer une sortie.
    const p = participant({ entree: T0 })

    expect(estPresentDansLaTranche(p, tranche(240, 24))).toBe(true)
  })
})

describe('tranchesDepuisBornes', () => {
  it('découpe une journée en tranches de vingt minutes', () => {
    const tranches = decouperEnTranches(T0, T0 + JOUR, 20)

    expect(tranches).toHaveLength(72)
    expect(tranches[0]).toEqual({ debut: T0, fin: T0 + 20 * 60_000 })
  })

  it('couvre les cinq granularités demandées', () => {
    // 1 jour, 12 h, 6 h, 1 h, 20 min sur trois jours.
    const attendu = { 1440: 3, 720: 6, 360: 12, 60: 72, 20: 216 }

    for (const [minutes, nombre] of Object.entries(attendu)) {
      expect(decouperEnTranches(T0, T0 + 3 * JOUR, Number(minutes))).toHaveLength(nombre)
    }
  })

  it('rend un tableau vide sur une période nulle ou inversée', () => {
    expect(decouperEnTranches(T0, T0, 60)).toEqual([])
    expect(decouperEnTranches(T0 + JOUR, T0, 60)).toEqual([])
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
  it('ne compte qu’une fois une personne présente à deux titres', () => {
    /*
     * Le cœur du « personnes physiques » demandé. Deux lignes de journal — sa candidature de
     * bénévole et son billet — mais un seul corps sur le site.
     */
    const tranches = decouperEnTranches(T0, T0 + JOUR, 1440)
    const memePersonne = [
      participant({ identite: 'compte:7', entree: T0 + 8 * H }),
      participant({ identite: 'compte:7', entree: T0 + 9 * H }),
    ]

    expect(compterAffluence(memePersonne, tranches)).toEqual([1])
  })

  it('compte deux personnes distinctes', () => {
    // La contrepartie : sans elle, un dédoublonnage trop large passerait le test précédent en
    // ramenant tout le monde à une unité.
    const tranches = decouperEnTranches(T0, T0 + JOUR, 1440)
    const deux = [
      participant({ identite: 'compte:7' }),
      participant({ identite: 'courriel:a@b.test' }),
    ]

    expect(compterAffluence(deux, tranches)).toEqual([2])
  })

  it('dessine une courbe qui monte puis redescend', () => {
    /*
     * Ce que tout le dispositif cherche à obtenir. Sans fenêtre de fin, aucune sortie n'étant
     * enregistrée, cette courbe ne pourrait que croître.
     *
     * Trois personnes sur trois jours : une présente tout le temps, une qui repart au bout d'un
     * jour, une qui arrive le dernier.
     */
    const tranches = decouperEnTranches(T0, T0 + 3 * JOUR, 1440)
    const gens = [
      participant({ identite: 'a', entree: T0, fenetre: { arrivee: null, depart: T0 + 3 * JOUR } }),
      participant({ identite: 'b', entree: T0, fenetre: { arrivee: null, depart: T0 + JOUR } }),
      participant({
        identite: 'c',
        entree: T0 + 2 * JOUR + 10 * H,
        fenetre: { arrivee: null, depart: T0 + 3 * JOUR },
      }),
    ]

    expect(compterAffluence(gens, tranches)).toEqual([2, 1, 2])
  })

  it('rend des zéros sur une édition où personne n’est entré', () => {
    const tranches = decouperEnTranches(T0, T0 + 2 * JOUR, 1440)

    expect(compterAffluence([], tranches)).toEqual([0, 0])
  })

  it('ne rend rien sans tranche', () => {
    expect(compterAffluence([participant()], [])).toEqual([])
  })
})

describe('sommetDeLAffluence', () => {
  it('trouve le maximum et l’instant où il se produit', () => {
    const tranches = decouperEnTranches(T0, T0 + 3 * JOUR, 1440)

    expect(sommetDeLAffluence([2, 9, 4], tranches)).toEqual({
      valeur: 9,
      debut: T0 + JOUR,
    })
  })

  it('retient le PREMIER sommet en cas d’égalité', () => {
    // Arbitraire mais fixé : « le plus fort a eu lieu à » doit désigner un instant, et le premier
    // est celui qu'on cherche quand on veut savoir quand la pression est montée.
    const tranches = decouperEnTranches(T0, T0 + 3 * JOUR, 1440)

    expect(sommetDeLAffluence([5, 5, 1], tranches).debut).toBe(T0)
  })

  it('rend zéro et aucun instant sur une courbe plate à zéro', () => {
    const tranches = decouperEnTranches(T0, T0 + 2 * JOUR, 1440)

    expect(sommetDeLAffluence([0, 0], tranches)).toEqual({ valeur: 0, debut: null })
  })
})
