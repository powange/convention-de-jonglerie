import { describe, it, expect, beforeEach, vi } from 'vitest'

const commentaireRecu = vi.hoisted(() => vi.fn(async () => ({ id: 'notif-1' })))

vi.mock('../../../../../server/utils/notification-service', () => ({
  NotificationHelpers: { carpoolCommentReceived: commentaireRecu },
  // `safeNotify` n'est PAS remplacé par un mock nu : il avale les erreurs, et c'est justement ce
  // comportement qu'un des tests éprouve. On garde donc sa vraie mécanique.
  safeNotify: async (operation: () => Promise<unknown>) => {
    try {
      return await operation()
    } catch {
      return null
    }
  },
}))

import surOffre from '../../../../../../../layers/carpool/server/api/carpool-offers/[id]/comments.post'
import surDemande from '../../../../../../../layers/carpool/server/api/carpool-requests/[id]/comments.post'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Commenter un covoiturage prévient les intéressés.
 *
 * ⚠️ CE QUI MANQUAIT, et pourquoi c'était pire qu'une absence. Le libellé du réglage promettait déjà
 * ces notifications — « Soyez notifié des réservations ET MESSAGES de covoiturage » — et rien ne les
 * envoyait. Une promesse non tenue fait cesser de venir regarder : on croit qu'on sera prévenu.
 *
 * Trois règles, et chacune a son test parce que chacune peut se tromper seule :
 *
 * 1. l'auteur de l'annonce est prévenu — c'est à lui qu'on s'adresse ;
 * 2. les AUTRES commentateurs aussi — un fil est une conversation, celui qui a posé une question
 *    doit savoir qu'on y répond, même si l'annonce n'est pas la sienne ;
 * 3. jamais celui qui vient d'écrire, et le dédoublonnage compte : l'auteur de l'annonce est le
 *    plus souvent aussi un commentateur, et sans `Set` il recevrait deux notifications.
 */

const AUTEUR_ANNONCE = 10
const COMMENTATEUR = 20
const AUTRE_COMMENTATEUR = 30
const EDITION = 22
const OFFRE = 5

const evenement = {
  context: { params: { id: String(OFFRE) }, user: { id: COMMENTATEUR, pseudo: 'Camille' } },
}

const commentaireCree = {
  id: 1,
  carpoolOfferId: OFFRE,
  userId: COMMENTATEUR,
  content: 'Encore une place ?',
  createdAt: new Date(),
  user: { id: COMMENTATEUR, pseudo: 'Camille' },
}

describe('POST /api/carpool-offers/[id]/comments — notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn(() => String(OFFRE))
    global.readBody = vi.fn().mockResolvedValue({ content: 'Encore une place ?' })
    prismaMock.carpoolOffer.findUnique.mockResolvedValue({
      id: OFFRE,
      userId: AUTEUR_ANNONCE,
      editionId: EDITION,
    })
    prismaMock.carpoolComment.create.mockResolvedValue(commentaireCree)
    prismaMock.carpoolComment.findMany.mockResolvedValue([{ userId: COMMENTATEUR }])
  })

  it('prévient l’auteur de l’offre', async () => {
    await surOffre(evenement as any)

    expect(commentaireRecu).toHaveBeenCalledWith(AUTEUR_ANNONCE, 'Camille', 'offer', OFFRE, EDITION)
  })

  it('prévient aussi les AUTRES commentateurs', async () => {
    // Le fil est une conversation : qui a posé une question doit savoir qu'on y répond, même sur
    // l'annonce de quelqu'un d'autre.
    prismaMock.carpoolComment.findMany.mockResolvedValue([
      { userId: COMMENTATEUR },
      { userId: AUTRE_COMMENTATEUR },
    ])

    await surOffre(evenement as any)

    const destinataires = commentaireRecu.mock.calls.map((appel) => appel[0])
    expect(destinataires).toContain(AUTRE_COMMENTATEUR)
    expect(destinataires).toContain(AUTEUR_ANNONCE)
  })

  it('ne se prévient JAMAIS soi-même', async () => {
    prismaMock.carpoolComment.findMany.mockResolvedValue([
      { userId: COMMENTATEUR },
      { userId: AUTRE_COMMENTATEUR },
    ])

    await surOffre(evenement as any)

    expect(commentaireRecu.mock.calls.map((appel) => appel[0])).not.toContain(COMMENTATEUR)
  })

  it('ne prévient l’auteur qu’UNE fois s’il a aussi commenté', async () => {
    /*
     * Le cas le plus fréquent, et celui qu'un oubli de dédoublonnage produit : l'auteur d'une offre
     * répond presque toujours dans son propre fil. Sans `Set`, il recevrait deux notifications
     * pour un seul message.
     */
    prismaMock.carpoolComment.findMany.mockResolvedValue([
      { userId: AUTEUR_ANNONCE },
      { userId: COMMENTATEUR },
    ])

    await surOffre(evenement as any)

    const pourLAuteur = commentaireRecu.mock.calls.filter((appel) => appel[0] === AUTEUR_ANNONCE)
    expect(pourLAuteur).toHaveLength(1)
  })

  it('n’envoie rien quand l’auteur commente seul sa propre offre', async () => {
    // Personne d'autre n'est concerné : une notification serait un courriel pour rien.
    prismaMock.carpoolOffer.findUnique.mockResolvedValue({
      id: OFFRE,
      userId: COMMENTATEUR,
      editionId: EDITION,
    })
    prismaMock.carpoolComment.findMany.mockResolvedValue([{ userId: COMMENTATEUR }])

    await surOffre(evenement as any)

    expect(commentaireRecu).not.toHaveBeenCalled()
  })

  it('demande les commentateurs DISTINCTS, pas toutes les lignes', async () => {
    // Un fil de vingt commentaires écrits par trois personnes ne doit pas ramener vingt lignes.
    await surOffre(evenement as any)

    expect(prismaMock.carpoolComment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ distinct: ['userId'] })
    )
  })

  it('enregistre le commentaire même si la notification échoue', async () => {
    /*
     * L'invariant qui protège l'essentiel : un commentaire perdu parce qu'une notification a raté
     * serait un défaut bien plus grave que l'absence de notification. C'est le rôle de
     * `safeNotify`, dont la vraie mécanique est conservée dans ce fichier.
     */
    commentaireRecu.mockRejectedValue(new Error('service de notification indisponible'))

    const reponse: any = await surOffre(evenement as any)

    expect(reponse.success).toBe(true)
    expect(prismaMock.carpoolComment.create).toHaveBeenCalled()
  })
})

describe('POST /api/carpool-requests/[id]/comments — notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn(() => String(OFFRE))
    global.readBody = vi.fn().mockResolvedValue({ content: 'Je peux te prendre' })
    prismaMock.carpoolRequest.findUnique.mockResolvedValue({
      id: OFFRE,
      userId: AUTEUR_ANNONCE,
      editionId: EDITION,
    })
    prismaMock.carpoolRequestComment.create.mockResolvedValue({
      id: 2,
      carpoolRequestId: OFFRE,
      userId: COMMENTATEUR,
      user: { id: COMMENTATEUR, pseudo: 'Camille' },
    })
    prismaMock.carpoolRequestComment.findMany.mockResolvedValue([{ userId: COMMENTATEUR }])
  })

  it('passe le type « request », dont dépendent l’URL et l’entité', async () => {
    // Offre et demande ne mènent pas à la même page : confondre les deux enverrait vers une URL
    // qui n'existe pas, et la notification serait un cul-de-sac.
    await surDemande(evenement as any)

    expect(commentaireRecu).toHaveBeenCalledWith(
      AUTEUR_ANNONCE,
      'Camille',
      'request',
      OFFRE,
      EDITION
    )
  })
})
