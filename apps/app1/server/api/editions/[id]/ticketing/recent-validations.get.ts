import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionDataOrAccessControl } from '#server/utils/permissions/edition-permissions'

/**
 * Les dix derniers mouvements d'entrée, lus dans le JOURNAL.
 *
 * Ce point d'API reconstruisait auparavant le fil à partir de l'**état courant** des quatre
 * tables : quatre balayages triés sur `entryValidatedAt`, fusionnés en mémoire. Cette approche a
 * un défaut qu'aucun réglage ne corrige — elle ne peut montrer que ce qui est encore vrai :
 *
 * - une entrée validée **puis annulée disparaissait** du fil, l'état ne la portant plus ;
 * - une **annulation n'y figurait jamais**, puisqu'il n'y avait rien à trier.
 *
 * Or c'est précisément la séquence qu'un agent a besoin de voir : quelqu'un est passé à 14 h, son
 * entrée a été retirée à 14 h 05. Le journal la conserve, et une seule requête indexée sur
 * `(editionId, createdAt)` remplace les quatre balayages.
 *
 * ⚠️ Le journal ne commence qu'au **19 septembre 2026**. Les validations antérieures ne
 * figureront donc pas dans ce fil — choix explicite : pour une liste des dix derniers mouvements,
 * lue debout à la porte, l'histoire ancienne n'apporte rien, et un mélange des deux sources
 * rendrait indiscernable un mouvement enregistré d'un mouvement reconstitué.
 */

/** Ce que le fil rend pour chaque mouvement, quelle que soit la population concernée. */
interface MouvementLisible {
  /** L'identifiant de la LIGNE DE JOURNAL, et non du participant : une même personne peut
   *  apparaître deux fois dans le fil, validée puis annulée. */
  id: number
  type: 'ticket' | 'volunteer' | 'artist' | 'organizer'
  movement: 'VALIDATED' | 'INVALIDATED'
  participantId: number
  firstName: string | null
  lastName: string | null
  email: string | null
  /** Le libellé propre à la ligne — nom du billet, titre de l'organisateur — ou `null` quand il
   *  n'y en a pas : le client nomme alors la population dans SA langue. */
  name: string | null
  entryValidatedAt: Date
  entryValidatedBy: number | null
  validator: unknown
}

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions (gestionnaires OU bénévoles en créneau actif de contrôle d'accès)
    const allowed = await canAccessEditionDataOrAccessControl(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })

    try {
      const mouvements = await prisma.entryValidationLog.findMany({
        where: { editionId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })

      if (mouvements.length === 0) {
        return createSuccessResponse({ validations: [] })
      }

      const idsParGenre = (genre: string) => [
        ...new Set(
          mouvements.filter((m) => m.participantKind === genre).map((m) => m.participantId)
        ),
      ]

      /**
       * Les noms sont résolus À LA LECTURE, le journal ne portant que `(genre, identifiant)`.
       *
       * Conséquence assumée : une ligne dont la commande ou le compte a été supprimé ne peut plus
       * nommer sa personne. Elle reste affichée — le mouvement a eu lieu — mais sans nom. Masquer
       * la ligne reviendrait à faire disparaître du fil ce que le journal existe pour conserver.
       *
       * Une requête par population PRÉSENTE, et non quatre systématiquement : un fil de dix
       * mouvements n'en contient presque jamais plus d'une ou deux.
       */
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
                // `title` vit sur ConventionOrganizer, pas sur EditionOrganizer : il se lit à
                // travers la relation. L'aplatir d'un niveau faisait rejeter TOUTE la requête
                // par Prisma — un 500 que ni le typage ni les tests à mock ne voient.
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
       * ⚠️ C'est la seule lecture de validateur du dépôt qui ne passe PAS par
       * `nom-du-validateur.ts` : celui-ci rend un prénom et un nom pour une étiquette, là où cet
       * écran affiche un avatar. Les y ramener ferait charger sept colonnes aux neuf autres
       * appelants qui en demandent deux. C'est une vraie différence, pas une recopie.
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

      const validations: MouvementLisible[] = mouvements.map((mouvement) => {
        const auteur = mouvement.actorId ? auteursParId.get(mouvement.actorId) : undefined

        // Le libellé ne porte que ce qui est PROPRE à la ligne — nom du billet, titre de
        // l'organisateur. Nommer la population était fait ici, en français, alors que seul le
        // client connaît la langue de qui tient le guichet (constat B4).
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
          type: mouvement.participantKind.toLowerCase() as MouvementLisible['type'],
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

      return createSuccessResponse({ validations })
    } catch (error: unknown) {
      console.error('Database recent validations error:', error)
      throw createError({
        status: 500,
        message: 'Erreur lors de la récupération des validations',
      })
    }
  },
  { operationName: 'GET ticketing recent-validations' }
)
