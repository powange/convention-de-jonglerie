import { describe, it, expect, vi, beforeEach } from 'vitest'

const canManageArtists = vi.hoisted(() => vi.fn(() => false))
const getEditionWithPermissions = vi.hoisted(() => vi.fn(async () => ({ id: 7 })))

vi.mock('../../../../server/utils/permissions/edition-permissions', () => ({
  canManageArtists,
  getEditionWithPermissions,
}))

vi.mock('../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event: any) => {
    if (!event?.context?.user) {
      throw createError({ status: 401, message: 'Unauthorized' })
    }
    return event.context.user
  }),
}))

vi.mock('../../../../server/utils/upload-validation', () => ({
  validateUploadedFile: vi.fn(),
}))

/*
 * ⚠️ `storeFileLocally` EST UN AUTO-IMPORT du module nuxt-file-storage : le handler l'emploie sans
 * l'importer, donc `vi.mock('nuxt-file-storage')` N'INTERCEPTE RIEN. Le test échouait sur
 * « storeFileLocally is not defined », transformé en 500 — une raison sans rapport avec ce qu'il
 * éprouve.
 *
 * QUATRIÈME fois de la journée que ce dépôt paie un auto-import dans un test : `defineTask`,
 * `deleteFile`, `utilisateursResponsablesDeLEquipe`, et celui-ci. La globale est la seule prise.
 */
vi.hoisted(() => {
  ;(globalThis as any).storeFileLocally = vi.fn(async () => 'fichier.jpg')
})

import deposerAffiche from '../../../../server/api/files/show.post'
import maCandidature from '../../../../server/api/editions/[id]/shows-call/[showCallId]/my-application.get'
import { trouverRoutePublique } from '../../../../server/constants/public-routes'
import { global } from '../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Quatre défauts d'accès du module Artistes, tous silencieux, tous de la même famille : une même
 * question posée à deux endroits, et deux réponses différentes.
 *
 * • B4 — la page des APPELS OUVERTS était en erreur pour un visiteur. Son point d'API annonce dans
 *   son propre commentaire « accessible par tout le monde », et la page ne pose aucun middleware —
 *   mais la route n'était pas déclarée publique, donc le middleware rendait 401. Le lien de la
 *   notification « nouvel appel » menait à un écran cassé.
 *
 * • B5 — les SPECTACLES PUBLICS n'apparaissaient jamais sur la carte, pour DEUX raisons cumulées :
 *   route non publique (401 en anonyme) et, même connecté, un `transform` qui lisait une clé que
 *   la réponse ne porte plus.
 *
 * • B6 — DÉPOSER l'affiche d'un spectacle exigeait un droit que CRÉER le spectacle n'exige pas.
 *
 * • B14 — un appel HORS LIGNE livrait ses détails à tout compte connaissant son identifiant, et une
 *   édition hors ligne continuait d'accepter des candidatures.
 */

const EDITION = 7
const APPEL = 3

describe('B4 et B5 — les deux routes qui rendaient 401', () => {
  it('🔬 la liste des appels OUVERTS est publique', () => {
    /*
     * L'assertion qui ferme le défaut : aucun test du handler ne pouvait le révéler, puisque le
     * middleware refusait avant de l'atteindre. `hydrateSession` permet à un artiste connecté de
     * voir ses propres candidatures marquées.
     */
    const entree = trouverRoutePublique('/api/shows-call/open', 'GET')

    expect(entree).toBeDefined()
    expect(entree?.hydrateSession).toBe(true)
  })

  it('🔬 les représentations publiques d’une édition sont publiques', () => {
    const entree = trouverRoutePublique(`/api/editions/${EDITION}/shows/public`, 'GET')

    expect(entree).toBeDefined()
    expect(entree?.hydrateSession).toBe(true)
  })

  it('🔎 les ATELIERS d’une édition sont publics, eux aussi', () => {
    /*
     * 📍 CE POINT N'ÉTAIT PAS DANS LE RAPPORT. Il a été trouvé en sondant la carte publique dans un
     * navigateur : la page appelait `/editions/17/workshops` et recevait 401, au milieu de ses
     * autres requêtes. Le handler traite pourtant la session comme OPTIONNELLE — il est écrit pour
     * le public, comme les deux autres.
     *
     * C'est l'AUTRE MOITIÉ des popups de la carte : les réparer pour les spectacles seulement
     * aurait laissé les popups à moitié vides pour un visiteur, soit le symptôme même qu'on
     * venait traiter.
     */
    const entree = trouverRoutePublique(`/api/editions/${EDITION}/workshops`, 'GET')

    expect(entree).toBeDefined()
    expect(entree?.hydrateSession).toBe(true)
  })

  it('n’ouvre rien de plus que ces trois chemins', () => {
    // Un motif trop large rendrait publics des points d'API voisins, et une méthode oubliée
    // ouvrirait l'écriture.
    expect(trouverRoutePublique('/api/shows-call/open', 'POST')).toBeUndefined()
    expect(trouverRoutePublique('/api/shows-call/openings', 'GET')).toBeUndefined()
    expect(trouverRoutePublique(`/api/editions/${EDITION}/shows`, 'GET')).toBeUndefined()
    expect(trouverRoutePublique(`/api/editions/${EDITION}/shows/public/x`, 'GET')).toBeUndefined()
    expect(trouverRoutePublique(`/api/editions/${EDITION}/shows/public`, 'POST')).toBeUndefined()
    // Les ateliers : la liste seule, jamais une écriture ni une sous-ressource.
    expect(trouverRoutePublique(`/api/editions/${EDITION}/workshops`, 'POST')).toBeUndefined()
    expect(trouverRoutePublique(`/api/editions/${EDITION}/workshops/5`, 'GET')).toBeUndefined()
    expect(
      trouverRoutePublique(`/api/editions/${EDITION}/workshops/locations`, 'GET')
    ).toBeUndefined()
  })
})

describe('B6 — déposer l’affiche d’un spectacle', () => {
  const edition = {
    id: EDITION,
    creatorId: 99,
    convention: { authorId: 98, organizers: [] },
    organizerPermissions: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    /*
     * 📍 UN FICHIER, ET NON UN TABLEAU VIDE : le handler refuse d'emblée « Aucun fichier fourni »
     * (400) AVANT le contrôle de droits. Un jeu de données vide ferait donc échouer les tests de
     * permission sur une raison qui n'est pas la leur — ma première version l'a fait.
     */
    global.readBody = vi.fn().mockResolvedValue({
      // 📍 `metadata.entityId`, et non `editionId` : c'est là que ce point d'API lit l'édition.
      metadata: { entityId: String(EDITION) },
      files: [{ name: 'affiche.jpg', content: 'data:image/jpeg;base64,AAA', size: 1024 }],
    })
    prismaMock.edition.findUnique.mockResolvedValue(edition)
  })

  it('🔬 demande `canManageArtists`, le MÊME droit que créer un spectacle', async () => {
    /*
     * Créer ou modifier un spectacle exige `canManageArtists`. Le dépôt de l'affiche exigeait
     * `canEditEdition`, qui ne couvre PAS ce droit : un organisateur à qui l'on a délégué les
     * seuls artistes pouvait créer le spectacle, puis recevoir 403 au moment d'ajouter l'image.
     * La moitié d'un geste autorisée, l'autre refusée.
     */
    canManageArtists.mockReturnValue(true)

    await expect(deposerAffiche({ context: { user: { id: 5 } } } as never)).resolves.toBeDefined()

    expect(canManageArtists).toHaveBeenCalledWith(edition, { id: 5 })
  })

  it('REFUSE qui n’a aucun droit sur les artistes', async () => {
    canManageArtists.mockReturnValue(false)

    await expect(deposerAffiche({ context: { user: { id: 5 } } } as never)).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('charge ce que `canManageArtists` a besoin de lire', async () => {
    /*
     * ⚠️ On mesure la FORME de la requête, et ce n'est pas redondant : le mock de Prisma ignore
     * l'`include`, donc les tests ci-dessus resteraient VERTS si les organisateurs cessaient
     * d'être chargés. En vrai, `canManageArtists` lirait `undefined` et refuserait TOUT LE MONDE
     * sauf le créateur — le défaut d'origine, déplacé.
     */
    canManageArtists.mockReturnValue(true)

    await deposerAffiche({ context: { user: { id: 5 } } } as never)

    const include = prismaMock.edition.findUnique.mock.calls[0][0].include
    expect(include.convention.include.organizers).toBeTruthy()
    expect(include.organizerPermissions).toBeTruthy()
  })

  it('refuse un anonyme', async () => {
    await expect(deposerAffiche({ context: {} } as never)).rejects.toMatchObject({
      statusCode: 401,
    })
  })
})

describe('B14 — un appel hors ligne et sa candidature', () => {
  const candidature = { id: 1, showCallId: APPEL, userId: 5, status: 'PENDING' }
  const evenement = { context: { user: { id: 5 } } } as never

  const appel = (visibility: string) => ({
    id: APPEL,
    editionId: EDITION,
    name: 'Cabaret du samedi',
    visibility,
    mode: 'INTERNAL',
    externalUrl: null,
    description: 'Une description en préparation',
    deadline: new Date('2027-01-01'),
    askPortfolioUrl: true,
    askVideoUrl: false,
    askTechnicalNeeds: false,
    askStageSetup: false,
    askAccommodation: false,
    askDepartureCity: false,
    requirePhone: false,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn((_e: unknown, nom: string) =>
      nom === 'showCallId' ? String(APPEL) : String(EDITION)
    )
    canManageArtists.mockReturnValue(false)
    getEditionWithPermissions.mockResolvedValue({ id: EDITION } as never)
    prismaMock.showApplication.findUnique.mockResolvedValue(candidature)
  })

  it('🔬 TAIT les détails d’un appel HORS LIGNE', async () => {
    /*
     * Ce point d'API rendait SANS CONDITION le nom, la description, la date limite et les réglages
     * de n'importe quel appel de l'édition, OFFLINE compris : un identifiant deviné suffisait à
     * lire un appel en préparation. `public.get.ts` le refuse pourtant depuis toujours — deux
     * réponses différentes à la même question, et c'est la plus permissive qui servait de porte.
     */
    prismaMock.editionShowCall.findFirst.mockResolvedValue(appel('OFFLINE'))

    const reponse: any = await maCandidature(evenement)

    expect(reponse.showCall).toBeNull()
  })

  it('🔬 GARDE la candidature de la personne, même sur un appel hors ligne', async () => {
    /*
     * ⚠️ La distinction qui compte. La candidature appartient à qui la demande : la lui cacher
     * parce que l'organisateur a remis l'appel hors ligne lui retirerait la trace de sa propre
     * démarche — alors qu'il l'a bien déposée. Seuls les DÉTAILS DE L'APPEL se taisent.
     */
    prismaMock.editionShowCall.findFirst.mockResolvedValue(appel('OFFLINE'))

    const reponse: any = await maCandidature(evenement)

    expect(reponse.application).toEqual(candidature)
  })

  it('MONTRE l’appel hors ligne à qui gère les artistes', async () => {
    // L'aperçu des organisateurs, comme `public.get.ts` l'accorde déjà en mode preview.
    prismaMock.editionShowCall.findFirst.mockResolvedValue(appel('OFFLINE'))
    canManageArtists.mockReturnValue(true)

    const reponse: any = await maCandidature(evenement)

    expect(reponse.showCall?.name).toBe('Cabaret du samedi')
  })

  it.each(['PUBLIC', 'PRIVATE'])('montre un appel %s à tout le monde', async (visibility) => {
    prismaMock.editionShowCall.findFirst.mockResolvedValue(appel(visibility))

    const reponse: any = await maCandidature(evenement)

    expect(reponse.showCall?.name).toBe('Cabaret du samedi')
    // Et l'on n'interroge pas les droits pour rien.
    expect(getEditionWithPermissions).not.toHaveBeenCalled()
  })

  it('rend deux `null` pour un appel inexistant', async () => {
    prismaMock.editionShowCall.findFirst.mockResolvedValue(null)

    const reponse: any = await maCandidature(evenement)

    expect(reponse).toEqual({ application: null, showCall: null })
  })

  it('refuse un anonyme', async () => {
    await expect(maCandidature({ context: {} } as never)).rejects.toMatchObject({
      statusCode: 401,
    })
  })
})
