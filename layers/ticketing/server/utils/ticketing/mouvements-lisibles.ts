/**
 * Rendre lisibles des lignes de journal : leur donner un nom, et un auteur.
 *
 * `EntryValidationLog` ne porte qu'un couple `(genre, identifiant)` — délibérément, pour survivre
 * à la disparition d'une candidature ou d'une ligne de commande. Tout écran qui l'affiche doit
 * donc résoudre les noms à la lecture, dans les quatre tables.
 *
 * Deux écrans le font déjà — le fil des dix derniers mouvements et l'historique complet — et ce
 * module existe pour qu'ils ne le fassent pas chacun de leur côté. C'est la leçon du constat A3 :
 * la règle « qui a validé » y avait été recopiée neuf fois avant qu'on s'en aperçoive, et elle
 * avait produit deux fois le même défaut.
 */

import type { EntryValidationLog } from '#server/types/prisma'

export type GenreDeParticipant = 'ticket' | 'volunteer' | 'artist' | 'organizer'

export interface MouvementLisible {
  /** L'identifiant de la LIGNE DE JOURNAL, et non du participant : une même personne peut
   *  apparaître plusieurs fois, validée puis annulée. */
  id: number
  type: GenreDeParticipant
  movement: 'VALIDATED' | 'INVALIDATED'
  participantId: number
  firstName: string | null
  lastName: string | null
  email: string | null
  /** Le libellé propre à la ligne — nom du billet, titre de l'organisateur — ou `null` quand il
   *  n'y en a pas : le client nomme alors la population dans SA langue (constat B4). */
  name: string | null
  entryValidatedAt: Date
  entryValidatedBy: number | null
  validator: unknown
}

/**
 * Les noms sont résolus À LA LECTURE, et une requête par population RÉELLEMENT PRÉSENTE.
 *
 * Conséquence assumée de ne pas stocker les noms : une ligne dont la commande ou le compte a été
 * supprimé ne peut plus nommer sa personne. Elle reste affichée — le mouvement a eu lieu — mais
 * sans nom. La masquer reviendrait à faire disparaître ce que le journal existe pour conserver.
 */
export async function rendreLisibles(
  mouvements: Pick<
    EntryValidationLog,
    'id' | 'participantKind' | 'participantId' | 'movement' | 'actorId' | 'createdAt'
  >[]
): Promise<MouvementLisible[]> {
  if (mouvements.length === 0) return []

  const idsParGenre = (genre: string) => [
    ...new Set(mouvements.filter((m) => m.participantKind === genre).map((m) => m.participantId)),
  ]

  const [billets, benevoles, artistes, organisateurs] = await Promise.all([
    idsParGenre('TICKET').length
      ? prisma.ticketingOrderItem.findMany({
          where: { id: { in: idsParGenre('TICKET') } },
          select: { id: true, firstName: true, lastName: true, email: true, name: true },
        })
      : [],
    idsParGenre('VOLUNTEER').length
      ? prisma.editionVolunteerApplication.findMany({
          where: { id: { in: idsParGenre('VOLUNTEER') } },
          select: { id: true, user: { select: { prenom: true, nom: true, email: true } } },
        })
      : [],
    idsParGenre('ARTIST').length
      ? prisma.editionArtist.findMany({
          where: { id: { in: idsParGenre('ARTIST') } },
          select: { id: true, user: { select: { prenom: true, nom: true, email: true } } },
        })
      : [],
    idsParGenre('ORGANIZER').length
      ? prisma.editionOrganizer.findMany({
          where: { id: { in: idsParGenre('ORGANIZER') } },
          select: {
            id: true,
            // `title` vit sur ConventionOrganizer, pas sur EditionOrganizer : il se lit à travers
            // la relation. L'aplatir d'un niveau faisait rejeter TOUTE la requête par Prisma.
            organizer: {
              select: {
                title: true,
                user: { select: { prenom: true, nom: true, email: true } },
              },
            },
          },
        })
      : [],
  ])

  const parId = <T extends { id: number }>(lignes: T[]) => new Map(lignes.map((l) => [l.id, l]))
  const billetsParId = parId(billets)
  const benevolesParId = parId(benevoles)
  const artistesParId = parId(artistes)
  const organisateursParId = parId(organisateurs)

  /**
   * L'auteur du mouvement, avec sa vignette.
   *
   * ⚠️ C'est la seule lecture de validateur du dépôt qui ne passe PAS par `nom-du-validateur.ts` :
   * celui-ci rend un prénom et un nom pour une étiquette, là où ces écrans affichent un avatar.
   * L'y ramener ferait charger sept colonnes aux appelants qui en demandent deux.
   */
  const idsAuteurs = [
    ...new Set(
      mouvements.map((m) => m.actorId).filter((id): id is number => typeof id === 'number')
    ),
  ]
  const auteurs = idsAuteurs.length
    ? await prisma.user.findMany({
        where: { id: { in: idsAuteurs } },
        select: {
          id: true,
          pseudo: true,
          prenom: true,
          nom: true,
          email: true,
          emailHash: true,
          profilePicture: true,
          updatedAt: true,
        },
      })
    : []
  const auteursParId = new Map(auteurs.map((u) => [u.id, u]))

  return mouvements.map((mouvement) => {
    const auteur = mouvement.actorId ? auteursParId.get(mouvement.actorId) : undefined

    let personne: { prenom?: string | null; nom?: string | null; email?: string | null } = {}
    let libelle: string | null = null

    if (mouvement.participantKind === 'TICKET') {
      const billet = billetsParId.get(mouvement.participantId)
      personne = {
        prenom: billet?.firstName ?? null,
        nom: billet?.lastName ?? null,
        email: billet?.email ?? null,
      }
      libelle = billet?.name ?? null
    } else if (mouvement.participantKind === 'VOLUNTEER') {
      personne = benevolesParId.get(mouvement.participantId)?.user ?? {}
    } else if (mouvement.participantKind === 'ARTIST') {
      personne = artistesParId.get(mouvement.participantId)?.user ?? {}
    } else {
      const organisateur = organisateursParId.get(mouvement.participantId)
      personne = organisateur?.organizer.user ?? {}
      libelle = organisateur?.organizer.title ?? null
    }

    return {
      id: mouvement.id,
      type: mouvement.participantKind.toLowerCase() as GenreDeParticipant,
      movement: mouvement.movement,
      participantId: mouvement.participantId,
      firstName: personne.prenom ?? null,
      lastName: personne.nom ?? null,
      email: personne.email ?? null,
      name: libelle,
      entryValidatedAt: mouvement.createdAt,
      entryValidatedBy: mouvement.actorId,
      validator: auteur
        ? {
            id: auteur.id,
            pseudo: auteur.pseudo,
            prenom: auteur.prenom,
            nom: auteur.nom,
            email: auteur.email,
            emailHash: auteur.emailHash,
            profilePicture: auteur.profilePicture,
            updatedAt: auteur.updatedAt?.toISOString(),
          }
        : null,
    }
  })
}

/**
 * Les identifiants des participants dont le nom, le courriel ou le code de billet correspond.
 *
 * La recherche doit filtrer **avant** de paginer, sans quoi le compte total serait celui de tout
 * le journal. Or le journal ne porte pas les noms : on cherche donc d'abord les personnes dans
 * les quatre tables, puis on filtre le journal sur ce qu'on a trouvé.
 *
 * Conséquence directe : une ligne dont la personne a été supprimée est **introuvable par la
 * recherche**, alors qu'elle reste visible dans la liste non filtrée. C'est le prix de ne pas
 * stocker les noms, et il se paie ici.
 *
 * Le téléphone n'en fait pas partie : `TicketingOrderItem` n'en porte aucun, et une recherche par
 * numéro ne remonterait jamais un billet — l'absence de résultat se lirait comme « cette personne
 * n'est pas venue » plutôt que « on n'a pas son numéro ».
 */
export async function participantsCorrespondants(editionId: number, terme: string) {
  /**
   * La recherche se fait par MOTS, chacun devant se retrouver quelque part.
   *
   * Un `contains` sur le terme entier ne trouvait pas « Ada Lovelace » : aucun champ ne contient
   * cette chaîne, le prénom vaut « Ada » et le nom « Lovelace ». Or taper les deux est le geste
   * le plus naturel de qui cherche quelqu'un. Chaque mot est donc cherché séparément, et ils sont
   * combinés en ET : « ada love » trouve Ada Lovelace, mais pas Ada Byron.
   */
  const mots = terme.split(/\s+/).filter(Boolean)

  const surLeBillet = {
    AND: mots.map((mot) => ({
      OR: [
        { firstName: { contains: mot } },
        { lastName: { contains: mot } },
        { email: { contains: mot } },
        // Le code du billet : ce que la personne présente quand son nom ne dit rien.
        { qrCode: { contains: mot } },
      ],
    })),
  }

  const surLaPersonne = {
    AND: mots.map((mot) => ({
      OR: [{ prenom: { contains: mot } }, { nom: { contains: mot } }, { email: { contains: mot } }],
    })),
  }

  const [billets, benevoles, artistes, organisateurs] = await Promise.all([
    prisma.ticketingOrderItem.findMany({
      where: { order: { editionId }, ...surLeBillet },
      select: { id: true },
    }),
    prisma.editionVolunteerApplication.findMany({
      where: { eventId: editionId, user: surLaPersonne },
      select: { id: true },
    }),
    prisma.editionArtist.findMany({
      where: { editionId, user: surLaPersonne },
      select: { id: true },
    }),
    prisma.editionOrganizer.findMany({
      where: { editionId, organizer: { user: surLaPersonne } },
      select: { id: true },
    }),
  ])

  return {
    TICKET: billets.map((l) => l.id),
    VOLUNTEER: benevoles.map((l) => l.id),
    ARTIST: artistes.map((l) => l.id),
    ORGANIZER: organisateurs.map((l) => l.id),
  }
}
