import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockRequireAdmin = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/admin-auth', () => ({
  requireGlobalAdminWithDbCheck: mockRequireAdmin,
}))

import handler from '../../../../../server/api/admin/activity.get'
import { global } from '../../../globales-nitro'

/**
 * Ce que l'« Activité récente » de l'administration raconte — constat B7.
 *
 * ## Deux récits inventés sur la même page
 *
 * 1. **UNE PROMOTION QUI N'A PAS EU LIEU.** La source des promotions listait les comptes
 *    `isGlobalAdmin` dont `updatedAt` datait de moins de trente jours. Or `updatedAt` bouge au
 *    moindre geste : un administrateur qui corrigeait son numéro de téléphone « devenait super
 *    administrateur ». Mesuré sur la base de développement avant correctif : l'unique
 *    administrateur du jeu de données y figurait, sans avoir été promu récemment.
 * 2. **UN TRAITEMENT DATÉ DE LA SOUMISSION.** La ligne « Feedback traité » portait la date de
 *    réception du retour. La liste globale étant triée puis tronquée à dix activités, un retour
 *    reçu il y a trois mois et résolu ce matin était daté de trois mois — donc jamais affiché.
 *    Mesuré : 11 des 12 retours traités de la base de développement étaient dans ce cas.
 *
 * ## ⚠️ CE QUE LE MOCK PRISMA PERMET, ET CE QU'IL NE PERMET PAS
 *
 * Le mock central **ignore le `where`** : on ne peut donc pas éprouver le filtre SQL en lui
 * donnant des lignes et en regardant lesquelles ressortent. Deux prises existent, et les deux
 * sont nécessaires :
 *
 * - **la FORME de la requête** — c'est elle qui attrape un retour à `updatedAt` ;
 * - **le COMPORTEMENT sur les lignes rendues** — un compte sans date de promotion ne doit
 *   produire aucune ligne, même si le filtre le laissait passer.
 *
 * Et comme `prisma.user.findMany` sert **deux** requêtes du même `Promise.all` (les nouveaux
 * comptes, puis les promotions), on les distingue sur la présence d'un `where` — jamais sur le
 * nom du champ filtré, qui est précisément ce que ces tests mesurent.
 */
const prismaMock = (globalThis as any).prisma

const MODELES_VIDES = [
  'convention',
  'edition',
  'editionVolunteerApplication',
  'conventionClaimRequest',
  'conventionOrganizer',
  'carpoolOffer',
  'carpoolRequest',
  'volunteerNotificationGroup',
] as const

type Activite = { id: string; type: string; title: string; createdAt: string }

const appeler = async ({ admins = [] as any[], feedbacks = [] as any[] }): Promise<Activite[]> => {
  // Le `where` sépare les deux requêtes sur `user` : la source des nouveaux comptes n'en a pas.
  prismaMock.user.findMany.mockImplementation((args: any) => (args?.where ? admins : []))
  prismaMock.feedback.findMany.mockResolvedValue(feedbacks)
  return (await handler({ context: {} } as any)) as Activite[]
}

const requetePromotions = () =>
  prismaMock.user.findMany.mock.calls.map(([args]: [any]) => args).find((args: any) => args?.where)

describe('GET /api/admin/activity — promotions admin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 1, isGlobalAdmin: true })
    global.getQuery = vi.fn().mockReturnValue({})
    for (const modele of MODELES_VIDES) prismaMock[modele].findMany.mockResolvedValue([])
  })

  it('⚠️ NE FILTRE PAS SUR `updatedAt` — c’est tout le défaut', async () => {
    await appeler({})

    const requete = requetePromotions()
    expect(requete, 'la requête des promotions est introuvable').toBeTruthy()
    expect(requete.where.isGlobalAdmin).toBe(true)
    expect(
      requete.where.promotedAdminAt?.gt,
      'le filtre ne porte pas sur la date de promotion'
    ).toBeInstanceOf(Date)
    expect(
      'updatedAt' in requete.where,
      'le filtre retombe sur `updatedAt`, que tout changement de profil touche'
    ).toBe(false)
  })

  it('un compte SANS date de promotion ne produit aucune ligne', async () => {
    /*
     * Le cas mesuré : quelqu'un d'administrateur depuis toujours, qui vient de changer son
     * téléphone. `updatedAt` est d'aujourd'hui, `promotedAdminAt` est `null` — aucune promotion
     * n'a eu lieu, donc aucune ligne. C'est aussi le cas de TOUS les comptes promus avant la
     * colonne, et c'est assumé : leur promotion n'a laissé aucune trace, et en inventer une
     * datée d'aujourd'hui recréerait le défaut.
     */
    const activites = await appeler({
      admins: [
        {
          id: 7,
          prenom: 'Marie',
          nom: 'Dupont',
          pseudo: 'marie',
          promotedAdminAt: null,
          updatedAt: new Date(),
        },
      ],
    })

    expect(activites.filter((a) => a.type === 'admin_promoted')).toEqual([])
  })

  it('⚠️ LE TÉMOIN : une vraie promotion, elle, est annoncée et datée de la promotion', async () => {
    /*
     * Sans ce cas, le précédent serait satisfait par une source supprimée : plus aucune ligne,
     * jamais, et le test resterait vert en ne couvrant rien.
     */
    const promotion = new Date('2026-10-05T09:00:00.000Z')
    const activites = await appeler({
      admins: [
        {
          id: 7,
          prenom: 'Marie',
          nom: 'Dupont',
          pseudo: 'marie',
          promotedAdminAt: promotion,
          updatedAt: new Date('2026-10-11T18:00:00.000Z'),
        },
      ],
    })

    const ligne = activites.find((a) => a.type === 'admin_promoted')
    expect(ligne, 'la promotion n’est pas annoncée').toBeTruthy()
    expect(ligne!.createdAt).toBe(promotion.toISOString())
  })
})

describe('GET /api/admin/activity — date des retours', () => {
  const RECU = new Date('2026-07-14T10:00:00.000Z')
  const TRAITE = new Date('2026-10-11T08:30:00.000Z')

  const retour = (status: string) => ({
    id: 3,
    type: 'BUG',
    status,
    subject: 'La carte ne charge pas',
    createdAt: RECU,
    updatedAt: TRAITE,
    user: { prenom: 'Léa', nom: 'Martin', pseudo: 'lea' },
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 1, isGlobalAdmin: true })
    global.getQuery = vi.fn().mockReturnValue({})
    for (const modele of MODELES_VIDES) prismaMock[modele].findMany.mockResolvedValue([])
  })

  it('⚠️ UN RETOUR RÉSOLU PORTE SA DATE DE TRAITEMENT, pas celle de réception', async () => {
    const activites = await appeler({ feedbacks: [retour('RESOLVED')] })

    const ligne = activites.find((a) => a.type === 'feedback_resolved')
    expect(ligne, 'le retour résolu n’apparaît pas').toBeTruthy()
    expect(ligne!.createdAt).toBe(TRAITE.toISOString())
  })

  it('un retour REJETÉ est traité lui aussi, et daté pareil', async () => {
    const activites = await appeler({ feedbacks: [retour('REJECTED')] })

    const ligne = activites.find((a) => a.type === 'feedback_resolved')
    expect(ligne!.createdAt).toBe(TRAITE.toISOString())
  })

  it('⚠️ LE TÉMOIN : un retour NON traité garde sa date de réception', async () => {
    /*
     * La moitié qui manquerait sans lui : un point d'API qui daterait TOUT sur `updatedAt`
     * satisferait les deux cas précédents, et annoncerait « Nouveau feedback » à la date de la
     * dernière note interne — soit un retour reçu la semaine dernière présenté comme arrivé ce
     * matin.
     */
    const activites = await appeler({ feedbacks: [retour('NEW')] })

    const ligne = activites.find((a) => a.type === 'feedback_submitted')
    expect(ligne, 'le retour soumis n’apparaît pas').toBeTruthy()
    expect(ligne!.createdAt).toBe(RECU.toISOString())
  })

  it('la source des retours est ordonnée sur la date de traitement', async () => {
    /*
     * Dater correctement ne suffit pas : la liste globale est triée puis tronquée à dix lignes,
     * et seules les lignes RAMENÉES par la requête peuvent y figurer. Ordonnée sur la
     * soumission, elle ne ramenait jamais le retour reçu il y a trois mois et résolu ce matin.
     */
    await appeler({})

    expect(prismaMock.feedback.findMany.mock.calls[0][0].orderBy).toEqual({ updatedAt: 'desc' })
  })
})
