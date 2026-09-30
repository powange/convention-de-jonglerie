import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { H3Event } from 'h3'

vi.mock('../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event: any) => {
    if (!event?.context?.user) {
      throw createError({ status: 401, message: 'Unauthorized' })
    }
    return event.context.user
  }),
}))

import lire from '../../../../../server/api/profile/notification-preferences.get'
import ecrire from '../../../../../server/api/profile/notification-preferences.put'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Les deux points d'API des préférences de notification, qui n'avaient aucun test.
 *
 * ⚠️ CE QUE LE PUT FAISAIT, ET LE DÉFAUT QU'IL AURAIT CAUSÉ. Il ÉCRASAIT la colonne entière par le
 * corps reçu. Tant que le corps portait exactement les douze clés du formulaire, cela ne se voyait
 * pas. Mais ce lot en ajoute une treizième — et une page des préférences ouverte AVANT le
 * déploiement continue d'envoyer les douze anciennes.
 *
 * Deux conséquences, toutes deux silencieuses :
 *   1. avec un schéma exigeant la nouvelle clé, cette page rendrait 400 à qui clique
 *      « Enregistrer » ;
 *   2. avec un schéma tolérant mais une écriture qui remplace, le réglage de messagerie serait
 *      EFFACÉ — et comme son défaut est `true`, les notifications se rallumeraient toutes seules
 *      chez qui venait de les couper.
 *
 * C'est le motif déjà rencontré dans ce dépôt : durcir un contrat d'API casse les clients déjà
 * ouverts. D'où les deux tests marqués 🔬 ci-dessous.
 */

const UTILISATEUR = 7
const evenement = { context: { user: { id: UTILISATEUR } } } as unknown as H3Event
const anonyme = { context: {} } as unknown as H3Event

/** Ce qu'envoie une page chargée AVANT ce lot : les douze clés d'origine, pas une de plus. */
const corpsAncienClient = {
  volunteerReminders: true,
  applicationUpdates: true,
  conventionNews: true,
  systemNotifications: true,
  carpoolUpdates: true,
  artistUpdates: true,
  emailVolunteerReminders: false,
  emailApplicationUpdates: false,
  emailConventionNews: false,
  emailSystemNotifications: false,
  emailCarpoolUpdates: false,
  emailArtistUpdates: false,
}

const preferencesEcrites = () =>
  prismaMock.user.update.mock.calls[0][0].data.notificationPreferences as Record<string, unknown>

describe('GET /api/profile/notification-preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rend les DÉFAUTS pour un compte qui n’a jamais rien réglé', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ notificationPreferences: null })

    const reponse: any = await lire(evenement)

    expect(reponse.data.preferences.messengerMessages).toBe(true)
    expect(reponse.data.preferences.emailVolunteerReminders).toBe(false)
  })

  it('FUSIONNE les défauts avec ce qui est enregistré', async () => {
    /*
     * Le cas de tous les comptes existants : leur colonne ne contient pas la clé de messagerie,
     * ajoutée par ce lot. Sans la fusion, l'interrupteur s'afficherait éteint — et la page
     * l'enregistrerait éteint au premier clic sur « Enregistrer », alors que personne ne l'a
     * demandé.
     */
    prismaMock.user.findUnique.mockResolvedValue({
      notificationPreferences: { carpoolUpdates: false },
    })

    const reponse: any = await lire(evenement)

    expect(reponse.data.preferences.carpoolUpdates).toBe(false)
    expect(reponse.data.preferences.messengerMessages).toBe(true)
  })

  it('refuse un anonyme', async () => {
    await expect(lire(anonyme)).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('PUT /api/profile/notification-preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.user.findUnique.mockResolvedValue({ notificationPreferences: null })
    prismaMock.user.update.mockResolvedValue({ id: UTILISATEUR, notificationPreferences: {} })
  })

  it('enregistre la nouvelle préférence de messagerie', async () => {
    global.readBody = vi.fn().mockResolvedValue({ ...corpsAncienClient, messengerMessages: false })

    await ecrire(evenement)

    expect(preferencesEcrites().messengerMessages).toBe(false)
  })

  it('🔬 ACCEPTE le corps d’une page ouverte AVANT ce lot', async () => {
    /*
     * Douze clés, pas treize. Si `messengerMessages` était exigé par le schéma, ce test rendrait
     * 400 — et c'est exactement ce que lirait quelqu'un dont l'onglet était resté ouvert pendant
     * le déploiement.
     */
    global.readBody = vi.fn().mockResolvedValue(corpsAncienClient)

    await expect(ecrire(evenement)).resolves.toBeTruthy()
  })

  it('🔬 n’EFFACE PAS le réglage que le corps ne mentionne pas', async () => {
    /*
     * Le même vieux client, mais cette fois la personne avait DÉJÀ coupé la messagerie. L'écriture
     * qui remplaçait la colonne entière perdait ce `false`, et le défaut `true` rallumait les
     * notifications sans le dire.
     */
    prismaMock.user.findUnique.mockResolvedValue({
      notificationPreferences: { messengerMessages: false, carpoolUpdates: false },
    })
    global.readBody = vi.fn().mockResolvedValue(corpsAncienClient)

    await ecrire(evenement)

    const ecrit = preferencesEcrites()
    expect(ecrit.messengerMessages).toBe(false)
    // Ce que le corps dit, lui, doit bien l'emporter sur ce qui était enregistré.
    expect(ecrit.carpoolUpdates).toBe(true)
  })

  it('complète les clés absentes par les défauts', async () => {
    global.readBody = vi.fn().mockResolvedValue(corpsAncienClient)

    await ecrire(evenement)

    expect(preferencesEcrites().emailMessengerMessages).toBe(false)
  })

  it('REFUSE un corps qui n’est pas une liste de booléens', async () => {
    // Le formulaire n'envoie que des interrupteurs ; une chaîne ne peut venir que d'ailleurs.
    global.readBody = vi
      .fn()
      .mockResolvedValue({ ...corpsAncienClient, systemNotifications: 'oui' })

    await expect(ecrire(evenement)).rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('REFUSE un corps amputé d’une préférence historique', async () => {
    // Les douze clés d'origine restent exigées : les rendre optionnelles ferait passer un
    // formulaire à moitié rempli pour un enregistrement complet.
    const { carpoolUpdates: _retire, ...ampute } = corpsAncienClient
    global.readBody = vi.fn().mockResolvedValue(ampute)

    await expect(ecrire(evenement)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('refuse un anonyme', async () => {
    global.readBody = vi.fn().mockResolvedValue(corpsAncienClient)

    await expect(ecrire(anonyme)).rejects.toMatchObject({ statusCode: 401 })
  })
})
