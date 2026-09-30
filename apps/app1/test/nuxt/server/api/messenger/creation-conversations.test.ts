import { describe, it, expect, beforeEach, vi } from 'vitest'

const assurerConversationsEquipe = vi.hoisted(() => vi.fn(async () => undefined))
const assurerConversationsEquipeEnLot = vi.hoisted(() => vi.fn(async () => undefined))
const assurerBenevoleVersOrganisateurs = vi.hoisted(() => vi.fn(async () => 'conv-vo'))
const assurerGroupeOrganisateurs = vi.hoisted(() => vi.fn(async () => 'conv-og'))

vi.mock('../../../../../server/utils/messenger-helpers', () => ({
  ensureVolunteerConversations: assurerConversationsEquipe,
  assurerConversationsEquipeDesMembres: assurerConversationsEquipeEnLot,
  ensureVolunteerToOrganizersConversation: assurerBenevoleVersOrganisateurs,
  ensureOrganizersGroupConversation: assurerGroupeOrganisateurs,
}))

vi.mock('../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event: any) => {
    if (!event.context?.user) {
      throw createError({ status: 401, message: 'Unauthorized' })
    }
    return event.context.user
  }),
}))

import equipe from '../../../../../server/api/messenger/team-conversation.post'
import benevoleVersOrganisateurs from '../../../../../server/api/messenger/volunteer-to-organizers.post'
import groupeOrganisateurs from '../../../../../server/api/messenger/organizers-group.post'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Qui a le droit d'ouvrir une conversation — les trois points d'API qui en CRÉENT une.
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE, et ce qu'il remplace. `team-conversation.post.test.ts` comptait
 * dix tests, tous verts — mais il n'importait PAS le handler. Il définissait un `mockHandler` de
 * cinquante lignes recopiées dans le fichier de test, et éprouvait cette copie.
 *
 * Et la copie avait DÉJÀ divergé : elle filtrait sur `application: { editionId }` là où le vrai
 * handler filtre sur `application: { eventId: editionId }`. Un test qui enshrine un nom de champ
 * que le code n'emploie pas ne protège rien — il protège sa propre réimplémentation. Si le champ
 * du vrai handler était faux, ces dix tests seraient restés verts.
 *
 * ⚠️ CE QUE CES TROIS POINTS D'API DÉCIDENT est un droit d'ACCÈS, pas une commodité. Ouvrir une
 * conversation d'équipe, c'est y entrer — et y lire ce qui s'y dit. Un refus manquant ne se voit
 * pas : la conversation s'ouvre, et rien ne signale qu'elle n'aurait pas dû.
 */

const UTILISATEUR = 7
const EDITION = 3
const EQUIPE = 'team-1'

const evenement = { context: { user: { id: UTILISATEUR, pseudo: 'Alex' } }, node: { req: {} } }
const anonyme = { context: {}, node: { req: {} } }

describe('POST /api/messenger/team-conversation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn().mockResolvedValue({ editionId: EDITION, teamId: EQUIPE })
    prismaMock.applicationTeamAssignment.findFirst.mockResolvedValue({ id: 'aff-1' })
    prismaMock.applicationTeamAssignment.findMany.mockResolvedValue([
      { application: { userId: UTILISATEUR } },
      { application: { userId: 8 } },
    ])
    prismaMock.conversation.findFirst.mockResolvedValue({ id: 'conv-equipe' })
  })

  it('ouvre la conversation pour un membre accepté de l’équipe', async () => {
    const reponse: any = await equipe(evenement as any)

    expect(reponse.data.conversationId).toBe('conv-equipe')
  })

  it('REFUSE qui n’est pas membre de l’équipe', async () => {
    // Le cœur de ce point d'API. Sans ce refus, n'importe qui ouvrirait la conversation de
    // n'importe quelle équipe et lirait ce qui s'y dit.
    prismaMock.applicationTeamAssignment.findFirst.mockResolvedValue(null)

    await expect(equipe(evenement as any)).rejects.toThrow(/pas membre de cette équipe/)
    expect(assurerConversationsEquipeEnLot).not.toHaveBeenCalled()
  })

  it('cherche l’appartenance par `eventId`, PAS par `editionId`', async () => {
    /*
     * ⚠️ LE TEST QUI JUSTIFIE CE FICHIER. L'ancien test recopiait le handler et employait
     * `editionId` dans ce `where` ; le vrai code emploie `eventId`. Si les deux divergeaient à
     * nouveau, Prisma refuserait la requête entière et l'ouverture rendrait 500 — ou, pire, un
     * champ mal nommé mais accepté ferait correspondre la mauvaise chose.
     *
     * On mesure donc la FORME de la requête, que le mock de Prisma ignore par ailleurs.
     */
    await equipe(evenement as any)

    const where = prismaMock.applicationTeamAssignment.findFirst.mock.calls[0][0].where
    expect(where.application.eventId).toBe(EDITION)
    expect(where.application).not.toHaveProperty('editionId')
    expect(where.application.status).toBe('ACCEPTED')
    expect(where.application.userId).toBe(UTILISATEUR)
  })

  it('inscrit TOUS les membres acceptés, pas seulement le demandeur', async () => {
    /*
     * Une conversation d'équipe où seul celui qui l'ouvre est inscrit est une conversation vide :
     * il écrirait sans que personne ne reçoive. Le défaut serait silencieux — le message part, la
     * liste de destinataires est vide.
     */
    await equipe(evenement as any)

    const destinataires = assurerConversationsEquipeEnLot.mock.calls[0][2] as number[]
    expect(destinataires).toContain(UTILISATEUR)
    expect(destinataires).toContain(8)
  })

  it('ne synchronise qu’UNE FOIS, quelle que soit la taille de l’équipe', async () => {
    /*
     * 🔬 LE TEST DU LOT. Auparavant la synchronisation était appelée une fois pour le demandeur
     * puis une fois PAR MEMBRE, en série — quatre à huit requêtes chacune. Pour quarante
     * personnes, ouvrir la discussion coûtait ≈ 250 requêtes avant le premier message.
     *
     * Ce test échoue si l'on revient à une boucle : il compte les appels, pas les destinataires.
     */
    prismaMock.applicationTeamAssignment.findMany.mockResolvedValue(
      Array.from({ length: 40 }, (_, index) => ({ application: { userId: 100 + index } }))
    )

    await equipe(evenement as any)

    expect(assurerConversationsEquipeEnLot).toHaveBeenCalledTimes(1)
    expect(assurerConversationsEquipeEnLot.mock.calls[0][2]).toHaveLength(41)
  })

  it('refuse un `editionId` manquant', async () => {
    global.readBody = vi.fn().mockResolvedValue({ teamId: EQUIPE })

    await expect(equipe(evenement as any)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('refuse un corps incomplet', async () => {
    global.readBody = vi.fn().mockResolvedValue({ editionId: EDITION })

    await expect(equipe(evenement as any)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('ACCEPTE un `editionId` reçu en chaîne, et le convertit', async () => {
    /*
     * ⚠️ Le corps n'était pas validé du tout. Un `editionId` en chaîne — ce que fait un client qui
     * le tire d'un paramètre d'URL — passait le contrôle de présence, puis Prisma refusait la
     * requête sur un entier attendu : l'ouverture rendait 500. `coerce` accepte les deux écritures.
     */
    global.readBody = vi.fn().mockResolvedValue({ editionId: String(EDITION), teamId: EQUIPE })

    await equipe(evenement as any)

    expect(
      prismaMock.applicationTeamAssignment.findFirst.mock.calls[0][0].where.application.eventId
    ).toBe(EDITION)
  })

  it('refuse un anonyme', async () => {
    await expect(equipe(anonyme as any)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('rend 404 si la conversation n’a pas pu être créée', async () => {
    // Le cas où les aides ont tourné sans rien produire : mieux vaut un 404 lisible qu'un
    // `conversationId: undefined` que le client suivrait vers une conversation inexistante.
    prismaMock.conversation.findFirst.mockResolvedValue(null)

    await expect(equipe(evenement as any)).rejects.toThrow(/n'a pas pu être créée/)
  })
})

describe('POST /api/messenger/volunteer-to-organizers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn().mockResolvedValue({ editionId: EDITION })
    prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue({ id: 'cand-1' })
  })

  it('ouvre la conversation pour un bénévole ACCEPTÉ', async () => {
    const reponse: any = await benevoleVersOrganisateurs(evenement as any)

    expect(reponse.data.conversationId).toBe('conv-vo')
  })

  it('REFUSE qui n’est pas bénévole de cette édition', async () => {
    prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(null)

    await expect(benevoleVersOrganisateurs(evenement as any)).rejects.toThrow(/pas bénévole/)
    expect(assurerBenevoleVersOrganisateurs).not.toHaveBeenCalled()
  })

  it('exige le statut ACCEPTED, pas seulement une candidature', async () => {
    /*
     * Une candidature en attente ou refusée ne donne pas accès aux organisateurs. Le mock de
     * Prisma ignorant le `where`, seule une assertion sur la forme de la requête le vérifie : un
     * `status` disparu laisserait passer toutes les candidatures, et les tests de refus
     * ci-dessus resteraient VERTS puisqu'ils reposent sur un `findFirst` rendu à `null`.
     */
    await benevoleVersOrganisateurs(evenement as any)

    const where = prismaMock.editionVolunteerApplication.findFirst.mock.calls[0][0].where
    expect(where.status).toBe('ACCEPTED')
    expect(where.eventId).toBe(EDITION)
    expect(where.userId).toBe(UTILISATEUR)
  })

  it('refuse un corps sans édition', async () => {
    global.readBody = vi.fn().mockResolvedValue({})

    await expect(benevoleVersOrganisateurs(evenement as any)).rejects.toThrow(/requis/)
  })

  it('refuse un anonyme', async () => {
    await expect(benevoleVersOrganisateurs(anonyme as any)).rejects.toMatchObject({
      statusCode: 401,
    })
  })
})

describe('POST /api/messenger/organizers-group', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn().mockResolvedValue({ editionId: EDITION })
    prismaMock.editionOrganizer.findFirst.mockResolvedValue({ id: 'org-1' })
  })

  it('ouvre le groupe pour un organisateur de l’édition', async () => {
    const reponse: any = await groupeOrganisateurs(evenement as any)

    expect(reponse.data.conversationId).toBe('conv-og')
  })

  it('REFUSE qui n’est pas organisateur de cette édition', async () => {
    prismaMock.editionOrganizer.findFirst.mockResolvedValue(null)

    await expect(groupeOrganisateurs(evenement as any)).rejects.toThrow(/pas organisateur/)
    expect(assurerGroupeOrganisateurs).not.toHaveBeenCalled()
  })

  it('passe par la relation `organizer`, `EditionOrganizer` n’ayant pas de `userId`', async () => {
    /*
     * ⚠️ DÉFAUT DÉJÀ CORRIGÉ UNE FOIS, et le commentaire du handler le raconte : la requête
     * nommait un `userId` inexistant sur `EditionOrganizer`. Prisma refusait alors la requête
     * ENTIÈRE, et ouvrir ce groupe rendait 500.
     *
     * Rien ne verrouillait la correction. Ce test le fait — et il ne peut le faire que sur la
     * forme de la requête, le mock ignorant le `where`.
     */
    await groupeOrganisateurs(evenement as any)

    const where = prismaMock.editionOrganizer.findFirst.mock.calls[0][0].where
    expect(where.organizer).toEqual({ userId: UTILISATEUR })
    expect(where).not.toHaveProperty('userId')
    expect(where.editionId).toBe(EDITION)
  })

  it('refuse un corps sans édition', async () => {
    global.readBody = vi.fn().mockResolvedValue({})

    await expect(groupeOrganisateurs(evenement as any)).rejects.toThrow(/requis/)
  })

  it('refuse un anonyme', async () => {
    await expect(groupeOrganisateurs(anonyme as any)).rejects.toMatchObject({ statusCode: 401 })
  })
})
