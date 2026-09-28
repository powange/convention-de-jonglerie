import { describe, expect, it } from 'vitest'

import {
  transformCarpoolOffer,
  transformCarpoolRequest,
} from '../../../server/utils/carpool-transform'

/**
 * `transformCarpoolOffer` sert DEUX points d'API publics : la liste des offres d'une édition et le
 * détail d'une offre.
 *
 * Il rendait toutes les réservations de chaque offre — avec leur message et leur demandeur — à
 * n'importe quel visiteur. Un message de réservation est adressé au conducteur seul, et le fait
 * qu'une demande soit en attente ou refusée ne regarde pas les tiers.
 *
 * Ces tests portent sur les trois points de vue qui existent : un visiteur anonyme, un passager, et
 * le conducteur.
 */

const CONDUCTEUR = 7
const PASSAGER_ACCEPTE = 12
const DEMANDEUR_EN_ATTENTE = 34

/** Une offre avec une réservation de chaque statut, pour que le filtre ait quelque chose à trancher. */
const offre = () => ({
  id: 1,
  editionId: 42,
  userId: CONDUCTEUR,
  tripDate: '2026-10-02T08:00:00.000Z',
  locationCity: 'Paris',
  locationAddress: '1 rue du Départ',
  availableSeats: 4,
  description: 'Deux places à l’arrière',
  phoneNumber: '+33612345678',
  smokingAllowed: false,
  petsAllowed: true,
  musicAllowed: true,
  direction: 'TO_EVENT',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  user: { id: CONDUCTEUR, pseudo: 'Conducteur', emailHash: 'h1', updatedAt: 'x' },
  passengers: [],
  comments: [],
  bookings: [
    {
      id: 100,
      carpoolOfferId: 1,
      requestId: null,
      seats: 2,
      message: 'Je prends la banquette, merci !',
      status: 'ACCEPTED',
      createdAt: 'a',
      updatedAt: 'a',
      requesterId: PASSAGER_ACCEPTE,
      requester: { id: PASSAGER_ACCEPTE, pseudo: 'Passagère', emailHash: 'h2', updatedAt: 'x' },
    },
    {
      id: 101,
      carpoolOfferId: 1,
      requestId: null,
      seats: 1,
      message: 'Reste-t-il une place ? Mon numéro : 06 11 22 33 44',
      status: 'PENDING',
      createdAt: 'b',
      updatedAt: 'b',
      requesterId: DEMANDEUR_EN_ATTENTE,
      requester: { id: DEMANDEUR_EN_ATTENTE, pseudo: 'Candidat', emailHash: 'h3', updatedAt: 'x' },
    },
    {
      id: 102,
      carpoolOfferId: 1,
      requestId: null,
      seats: 1,
      message: 'Finalement non, désolé',
      status: 'REJECTED',
      createdAt: 'c',
      updatedAt: 'c',
      requesterId: 99,
      requester: { id: 99, pseudo: 'Éconduit', emailHash: 'h4', updatedAt: 'x' },
    },
  ],
})

describe('transformCarpoolOffer — ce que chaque viewer reçoit des réservations', () => {
  it('un visiteur anonyme ne voit que les réservations acceptées, sans message', () => {
    const vu = transformCarpoolOffer(offre())

    expect(vu.bookings.map((b) => b.status)).toEqual(['ACCEPTED'])
    expect(vu.bookings[0]).not.toHaveProperty('message')
  })

  it('un passager accepté ne voit pas davantage — pas même son propre message', () => {
    /*
     * Son message lui reste accessible par `GET /carpool-offers/:id/bookings`, qui le lui rend. Le
     * lui refuser ici évite d'avoir DEUX règles à tenir d'accord sur la même donnée, et supprime la
     * question « et si le viewer était aussi l'auteur de celle-là ? » à chaque relecture.
     */
    const vu = transformCarpoolOffer(offre(), PASSAGER_ACCEPTE)

    expect(vu.bookings.map((b) => b.status)).toEqual(['ACCEPTED'])
    expect(vu.bookings[0]).not.toHaveProperty('message')
  })

  it('un demandeur en attente ne voit pas sa propre demande dans la liste', () => {
    // Elle n'est pas ACCEPTED : l'exposer dirait à tous les visiteurs qu'une demande est pendante.
    const vu = transformCarpoolOffer(offre(), DEMANDEUR_EN_ATTENTE)

    expect(vu.bookings.map((b) => b.id)).toEqual([100])
  })

  it('le conducteur garde la liste complète, messages compris', () => {
    const vu = transformCarpoolOffer(offre(), CONDUCTEUR)

    expect(vu.bookings.map((b) => b.status)).toEqual(['ACCEPTED', 'PENDING', 'REJECTED'])
    expect(vu.bookings.map((b) => b.message)).toEqual([
      'Je prends la banquette, merci !',
      'Reste-t-il une place ? Mon numéro : 06 11 22 33 44',
      'Finalement non, désolé',
    ])
  })

  it('aucun message n’échappe, quel que soit le viewer non propriétaire', () => {
    /*
     * Le test qui vaut le plus : il cherche les messages dans la charge ENTIÈRE, sérialisée, au lieu
     * de n'inspecter que le tableau des réservations. Un message qui ressortirait par un autre
     * chemin — recopié dans un commentaire, une future propriété dérivée — serait attrapé ici, là
     * où une vérification champ par champ le laisserait passer.
     */
    const messages = offre().bookings.map((b) => b.message)

    for (const viewer of [undefined, PASSAGER_ACCEPTE, DEMANDEUR_EN_ATTENTE, 99]) {
      const serialise = JSON.stringify(transformCarpoolOffer(offre(), viewer))
      const fuites = messages.filter((m) => serialise.includes(m))
      expect(fuites, `viewer ${viewer ?? 'anonyme'}`).toEqual([])
    }
  })

  it('les places restantes se comptent sur TOUTES les acceptées, pas sur celles montrées', () => {
    /*
     * Le piège de ce correctif. Brancher `remainingSeats` sur la liste filtrée donnerait le bon
     * chiffre aujourd'hui — par accident, les ACCEPTED étant justement celles qu'on garde — et un
     * chiffre faux au premier resserrement du filtre.
     *
     * On l'éprouve donc là où les deux calculs diffèrent : une offre dont la seule ACCEPTED est
     * masquée à un tiers.
     */
    const avecDeuxAcceptees = offre()
    avecDeuxAcceptees.bookings[1]!.status = 'ACCEPTED'

    for (const viewer of [undefined, PASSAGER_ACCEPTE, CONDUCTEUR]) {
      // 4 places, 2 + 1 prises : il en reste 1, que le viewer voie les trois réservations ou une.
      expect(transformCarpoolOffer(avecDeuxAcceptees, viewer).remainingSeats).toBe(1)
    }
  })

  it('le demandeur reste nommé sur une réservation acceptée', () => {
    // Ces personnes sont déjà publiques par `passengers` : les masquer ici priverait les deux
    // composants du client de l'affichage « qui est à bord » sans rien protéger.
    const vu = transformCarpoolOffer(offre())

    expect(vu.bookings[0]?.requester?.pseudo).toBe('Passagère')
  })
})

/**
 * Les commentaires, selon le point d'API qui a construit l'objet.
 *
 * Les LISTES d'une édition ne demandent plus que `_count` : la carte d'une offre n'affiche qu'un
 * nombre, et la carte d'une demande ne les lisait même pas — elle laissait sa modale les redemander,
 * une requête de plus par carte. Le DÉTAIL, lui, charge la conversation.
 *
 * Ces cas vivaient dans les tests des deux points d'API de liste. Ils y sont devenus sans objet, mais
 * le masquage de l'email de l'auteur d'un commentaire reste à vérifier : il se joue ici.
 */
describe('transformCarpoolOffer / transformCarpoolRequest — les commentaires', () => {
  const commentaire = {
    id: 9,
    content: 'Je peux te prendre !',
    createdAt: 'c',
    updatedAt: 'c',
    user: { id: 55, pseudo: 'Conductrice', emailHash: 'h9', email: 'secret@example.com' },
  }

  it('rend le compte sans la conversation quand seul `_count` est chargé', () => {
    const vu = transformCarpoolOffer({ ...offre(), comments: undefined, _count: { comments: 3 } })

    expect(vu.commentsCount).toBe(3)
    // ABSENT, et non pas vide. `comments: []` se lirait « aucun commentaire » alors que le compte en
    // annonce trois : une contradiction qui ne lève aucune erreur et s'aperçoit des mois plus tard.
    expect(vu).not.toHaveProperty('comments')
  })

  it('rend la conversation et son compte quand elle est chargée', () => {
    const vu = transformCarpoolOffer({ ...offre(), comments: [commentaire] })

    expect(vu.commentsCount).toBe(1)
    expect(vu.comments?.[0]?.content).toBe('Je peux te prendre !')
  })

  it('masque l’email de l’auteur d’un commentaire', () => {
    const vu = transformCarpoolOffer({ ...offre(), comments: [commentaire] })

    expect(vu.comments?.[0]?.user).not.toHaveProperty('email')
    expect(vu.comments?.[0]?.user?.emailHash).toBe('h9')
    // Et rien ne ressort par un autre chemin.
    expect(JSON.stringify(vu)).not.toContain('secret@example.com')
  })

  it('préfère `_count` à la longueur de la liste quand les deux sont là', () => {
    // Le détail charge tout ; si un jour il demandait aussi le compte, c'est la base qui a raison.
    const vu = transformCarpoolOffer({
      ...offre(),
      comments: [commentaire],
      _count: { comments: 7 },
    })

    expect(vu.commentsCount).toBe(7)
  })

  it('rend zéro quand ni compte ni conversation ne sont chargés', () => {
    const vu = transformCarpoolOffer({ ...offre(), comments: undefined })

    expect(vu.commentsCount).toBe(0)
    expect(vu).not.toHaveProperty('comments')
  })

  it('applique la même règle aux demandes', () => {
    const demande = {
      id: 4,
      editionId: 42,
      userId: 8,
      tripDate: '2026-10-02T08:00:00.000Z',
      locationCity: 'Lyon',
      seatsNeeded: 2,
      direction: 'TO_EVENT',
      phoneNumber: '+33600000000',
      createdAt: 'd',
      user: { id: 8, pseudo: 'Demandeur', emailHash: 'h8', updatedAt: 'x' },
      _count: { comments: 2 },
    }

    const vu = transformCarpoolRequest(demande)

    expect(vu.commentsCount).toBe(2)
    expect(vu).not.toHaveProperty('comments')
  })
})
