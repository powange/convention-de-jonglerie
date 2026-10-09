import { describe, expect, it } from 'vitest'

import {
  demandesFiltrees,
  desFiltresSontPoses,
  FILTRES_AU_REPOS,
  offresFiltrees,
} from '../../../../../layers/carpool/app/utils/filtres-du-covoiturage'

import type { FiltresDuCovoiturage } from '../../../../../layers/carpool/app/utils/filtres-du-covoiturage'

/**
 * Affiner la liste des annonces de covoiturage.
 *
 * ## ⚠️ LE DÉFAUT : UNE LISTE QU'ON NE POUVAIT QUE PARCOURIR
 *
 * Une édition fréquentée porte des dizaines d'annonces, et la page n'offrait qu'un interrupteur
 * « archives ». Pour savoir si quelqu'un partait de sa ville, il fallait lire chaque carte — et
 * chaque carte dit par où elle passe, mais aucune ne dit qu'une autre en parle aussi.
 *
 * ## Pourquoi la règle est ici et non dans le composant
 *
 * `USelect` est un composant à gabarit libre : le piloter dans jsdom reviendrait à tester Reka UI
 * plutôt que ce filtre. Séparée, la règle s'éprouve directement — **croisements compris**, ce qui
 * est le seul moyen de prouver que les critères s'AJOUTENT au lieu de se remplacer. C'est la faute
 * la plus facile à commettre sur trois conditions, et la plus difficile à voir à l'écran : on croit
 * simplement qu'il n'y a rien.
 */
describe('filtres du covoiturage', () => {
  const offre = (p: Partial<Record<string, unknown>> = {}) => ({
    id: 1,
    direction: 'TO_EVENT',
    locationCity: 'Lyon',
    availableSeats: 4,
    remainingSeats: 2,
    ...p,
  })

  const avec = (p: Partial<FiltresDuCovoiturage> = {}): FiltresDuCovoiturage => ({
    ...FILTRES_AU_REPOS,
    ...p,
  })

  describe('au repos', () => {
    it('ne retire rien', () => {
      const annonces = [offre(), offre({ id: 2, direction: 'FROM_EVENT', locationCity: 'Paris' })]

      expect(offresFiltrees(annonces, avec())).toHaveLength(2)
      expect(demandesFiltrees(annonces, avec())).toHaveLength(2)
    })

    it("n'est pas vu comme un filtre posé", () => {
      expect(desFiltresSontPoses(avec())).toBe(false)
    })

    it('ne compte pas une saisie faite uniquement d’espaces', () => {
      /*
       * Un champ qu'on vide en laissant une espace, ou dans lequel on a frappé la barre par erreur,
       * n'est pas un filtre : le bouton « Réinitialiser » n'aurait rien à y faire, et l'état vide
       * annoncerait « aucune annonce ne correspond » devant une liste que personne n'a restreinte.
       */
      expect(desFiltresSontPoses(avec({ ville: '   ' }))).toBe(false)
      expect(offresFiltrees([offre()], avec({ ville: '   ' }))).toHaveLength(1)
    })

    it('est gelé', () => {
      /*
       * Il sert à la fois d'état initial, de cible du bouton « Réinitialiser » et de référence pour
       * `desFiltresSontPoses`. Une mutation par mégarde corromprait les trois d'un coup — et le
       * bouton ne reparaîtrait plus JAMAIS, puisque la comparaison se ferait contre l'état courant.
       */
      expect(Object.isFrozen(FILTRES_AU_REPOS)).toBe(true)
    })
  })

  describe('le sens du trajet', () => {
    const annonces = [
      offre({ id: 1, direction: 'TO_EVENT' }),
      offre({ id: 2, direction: 'FROM_EVENT' }),
      offre({ id: 3, direction: 'TO_EVENT' }),
    ]

    it('ne garde que l’aller', () => {
      expect(offresFiltrees(annonces, avec({ direction: 'TO_EVENT' })).map((a) => a.id)).toEqual([
        1, 3,
      ])
    })

    it('ne garde que le retour', () => {
      expect(offresFiltrees(annonces, avec({ direction: 'FROM_EVENT' })).map((a) => a.id)).toEqual([
        2,
      ])
    })

    it("s'applique aussi aux demandes", () => {
      /*
       * ⚠️ LE CAS QUI SÉPARE LES DEUX FONCTIONS. Elles partagent les critères communs, et une
       * demande se cherche par son sens exactement comme une offre : quelqu'un qui rentre cherche
       * un conducteur qui rentre. Sans ce cas, un oubli dans `demandesFiltrees` passerait.
       */
      expect(
        demandesFiltrees(annonces, avec({ direction: 'FROM_EVENT' })).map((a) => a.id)
      ).toEqual([2])
    })
  })

  describe('la ville', () => {
    it('trouve un début de nom', () => {
      const annonces = [offre({ id: 1, locationCity: 'Clermont-Ferrand' }), offre({ id: 2 })]

      expect(offresFiltrees(annonces, avec({ ville: 'clermont' })).map((a) => a.id)).toEqual([1])
    })

    it('ignore les accents et la casse', () => {
      /*
       * ⚠️ CE CAS EST LE CŒUR DU CHAMP. Les accents demandent un appui long sur un clavier de
       * téléphone — c'est le cas courant de cet écran, pas l'exception —, et une recherche qui les
       * exige ne trouve rien du tout. Le comparateur est celui que PARTAGE tout le dépôt
       * (`shared/utils/recherche-texte.ts`) : une septième copie de la normalisation finirait par
       * diverger d'un caractère, et deux écrans ne trouveraient plus les mêmes choses.
       */
      const annonces = [offre({ id: 1, locationCity: 'Châlons-en-Champagne' })]

      expect(offresFiltrees(annonces, avec({ ville: 'chalons' }))).toHaveLength(1)
      expect(offresFiltrees(annonces, avec({ ville: 'CHÂLONS' }))).toHaveLength(1)
      expect(offresFiltrees(annonces, avec({ ville: 'champagne' }))).toHaveLength(1)
    })

    it('ne trouve pas une ville absente', () => {
      // Le témoin négatif : sans lui, une fonction qui ne filtrerait RIEN satisferait tout ce qui
      // précède.
      expect(
        offresFiltrees([offre({ locationCity: 'Lyon' })], avec({ ville: 'marseille' }))
      ).toEqual([])
    })

    it('ne lève pas sur une ville absente de la donnée', () => {
      expect(offresFiltrees([offre({ locationCity: null })], avec({ ville: 'lyon' }))).toEqual([])
    })
  })

  describe('les places libres', () => {
    it('écarte une offre complète', () => {
      const annonces = [offre({ id: 1, remainingSeats: 0 }), offre({ id: 2, remainingSeats: 1 })]

      expect(offresFiltrees(annonces, avec({ placesSeulement: true })).map((a) => a.id)).toEqual([
        2,
      ])
    })

    it('emploie la règle partagée, donc le repli sur les réservations', () => {
      /*
       * Une offre passée à la main — une fiche construite côté client, un test — n'a pas le
       * `remainingSeats` du serveur. `placesRestantes` retombe alors sur les réservations acceptées,
       * et ce cas prouve que le filtre emprunte bien ce chemin plutôt que de lire un champ absent,
       * ce qui l'aurait fait considérer comme pleine toute offre sans ce champ.
       */
      const annonces = [
        offre({
          id: 1,
          remainingSeats: undefined,
          availableSeats: 2,
          bookings: [{ status: 'ACCEPTED', seats: 2 }],
        }),
        offre({
          id: 2,
          remainingSeats: undefined,
          availableSeats: 2,
          bookings: [{ status: 'PENDING', seats: 2 }],
        }),
      ]

      // La seconde n'a qu'une réservation EN ATTENTE : ses deux places sont encore à prendre.
      expect(offresFiltrees(annonces, avec({ placesSeulement: true })).map((a) => a.id)).toEqual([
        2,
      ])
    })

    it('ne touche PAS aux demandes, délibérément', () => {
      /*
       * ⚠️ UNE ASYMÉTRIE VOULUE, ET C'EST POURQUOI ELLE EST TESTÉE. Une demande ne transporte
       * personne : elle n'a aucune place à offrir, et la filtrer sur ce critère viderait l'onglet
       * sans raison. L'intitulé de la case porte le mot « Offres » pour que l'écran le dise aussi.
       *
       * Sans ce cas, quelqu'un « réparerait » un jour l'asymétrie en croyant combler un oubli.
       */
      const demandes = [offre({ id: 1, remainingSeats: 0, availableSeats: 0 })]

      expect(demandesFiltrees(demandes, avec({ placesSeulement: true })).map((a) => a.id)).toEqual([
        1,
      ])
    })
  })

  describe('les critères se croisent', () => {
    it("s'ajoutent au lieu de se remplacer", () => {
      /*
       * ⚠️ LE CAS QUI N'EST PAS DÉDUCTIBLE DES PRÉCÉDENTS. Chaque critère pris seul peut marcher
       * tandis que leur conjonction est fausse — un `||` au lieu d'un `&&`, un `return` trop tôt —,
       * et à l'écran cela ne ressemble pas à un défaut : on croit qu'il n'y a rien à montrer.
       *
       * Les trois annonces ci-dessous satisfont chacune DEUX des trois critères et une seule les
       * trois. Un seul critère ignoré en laisserait donc passer au moins deux.
       */
      const annonces = [
        offre({ id: 1, direction: 'TO_EVENT', locationCity: 'Lyon', remainingSeats: 2 }),
        offre({ id: 2, direction: 'FROM_EVENT', locationCity: 'Lyon', remainingSeats: 2 }),
        offre({ id: 3, direction: 'TO_EVENT', locationCity: 'Paris', remainingSeats: 2 }),
        offre({ id: 4, direction: 'TO_EVENT', locationCity: 'Lyon', remainingSeats: 0 }),
      ]

      const retenues = offresFiltrees(
        annonces,
        avec({ direction: 'TO_EVENT', ville: 'lyon', placesSeulement: true })
      )

      expect(retenues.map((a) => a.id)).toEqual([1])
    })

    it('chacun compte comme un filtre posé', () => {
      expect(desFiltresSontPoses(avec({ direction: 'TO_EVENT' }))).toBe(true)
      expect(desFiltresSontPoses(avec({ ville: 'lyon' }))).toBe(true)
      expect(desFiltresSontPoses(avec({ placesSeulement: true }))).toBe(true)
    })
  })

  it("ne modifie pas la liste qu'on lui donne", () => {
    // `filter` rend un nouveau tableau, mais c'est la propriété sur laquelle s'appuient les deux
    // états vides : ils comparent la liste filtrée à la liste COMPLÈTE.
    const annonces = [offre({ id: 1 }), offre({ id: 2, direction: 'FROM_EVENT' })]
    offresFiltrees(annonces, avec({ direction: 'TO_EVENT' }))

    expect(annonces).toHaveLength(2)
  })
})
