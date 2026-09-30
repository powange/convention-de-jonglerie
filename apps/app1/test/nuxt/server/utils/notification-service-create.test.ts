import { describe, it, expect, vi, beforeEach } from 'vitest'

const autoriseEnApplication = vi.hoisted(() => vi.fn(async () => true))
const autoriseParCourriel = vi.hoisted(() => vi.fn(async () => false))

vi.mock('../../../../server/utils/notification-preferences', async () => {
  const actual = await vi.importActual<any>('../../../../server/utils/notification-preferences')
  return {
    ...actual,
    isNotificationAllowed: autoriseEnApplication,
    isEmailNotificationAllowed: autoriseParCourriel,
  }
})

const pousserEnTempsReel = vi.hoisted(() => vi.fn(async () => true))
vi.mock('../../../../server/utils/notification-stream-manager', () => ({
  notificationStreamManager: { notifyUser: pousserEnTempsReel },
}))

const pousserEnPush = vi.hoisted(() => vi.fn(async () => true))
vi.mock('../../../../server/utils/unified-push-service', () => ({
  unifiedPushService: { sendToUser: pousserEnPush },
}))

const envoyerCourriel = vi.hoisted(() => vi.fn(async () => true))
vi.mock('../../../../server/utils/emailService', async () => {
  const actual = await vi.importActual<any>('../../../../server/utils/emailService')
  return { ...actual, sendEmail: envoyerCourriel }
})

import { NotificationService } from '../../../../server/utils/notification-service'

const prismaMock = (globalThis as any).prisma

/**
 * `NotificationService.create` — la pièce que TOUTE notification traverse, et qui n'avait aucun
 * test.
 *
 * Elle porte quatre décisions, chacune capable de se tromper seule :
 *
 * 1. refuser une notification vide (ni clé, ni texte) ;
 * 2. respecter les préférences de la personne — et rendre `null` plutôt qu'écrire une ligne ;
 * 3. traduire le push dans SA langue ;
 * 4. survivre à l'échec de n'importe lequel des trois canaux.
 *
 * ⚠️ LE POINT 4 EST LE PLUS IMPORTANT, et le moins visible. Une notification enregistrée en base
 * mais dont l'envoi temps réel a échoué se rattrape : la personne la verra dans sa liste. Une
 * notification PERDUE parce qu'un envoi a levé une exception ne se rattrape pas — et l'appelant,
 * lui, croit avoir prévenu. Les trois canaux sont donc chacun dans leur `try/catch`, et trois
 * tests le vérifient séparément : un seul `try` autour des trois laisserait les suivants muets
 * dès que le premier échoue.
 */

const UTILISATEUR = 42

const notificationCreee = {
  id: 'notif-1',
  userId: UTILISATEUR,
  type: 'INFO',
  titleKey: 'notifications.carpool.booking_revoked.title',
  messageKey: 'notifications.carpool.booking_revoked.message',
  translationParams: { ownerName: 'Camille', seats: 2, locationCity: 'Lyon' },
  actionTextKey: null,
  titleText: null,
  messageText: null,
  actionText: null,
  category: 'carpool',
  entityType: 'CarpoolOffer',
  entityId: '1',
  actionUrl: '/editions/7/carpool',
  isRead: false,
  createdAt: new Date(),
  user: {
    id: UTILISATEUR,
    pseudo: 'Alex',
    email: 'alex@example.com',
    preferredLanguage: 'nl',
  },
}

const donnees = {
  userId: UTILISATEUR,
  type: 'INFO' as const,
  titleKey: 'notifications.carpool.booking_revoked.title',
  messageKey: 'notifications.carpool.booking_revoked.message',
  translationParams: { ownerName: 'Camille', seats: 2, locationCity: 'Lyon' },
  category: 'carpool',
  entityType: 'CarpoolOffer',
  entityId: '1',
  actionUrl: '/editions/7/carpool',
  notificationType: 'carpool_booking_revoked' as const,
}

describe('NotificationService.create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    autoriseEnApplication.mockResolvedValue(true)
    autoriseParCourriel.mockResolvedValue(false)
    pousserEnTempsReel.mockResolvedValue(true)
    pousserEnPush.mockResolvedValue(true)
    prismaMock.notification.create.mockResolvedValue(notificationCreee)
    prismaMock.user.findUnique.mockResolvedValue(notificationCreee.user)
  })

  describe('ce qu’elle refuse', () => {
    it('refuse une notification sans clé ET sans texte', async () => {
      /*
       * Sans titre ni message, la ligne serait créée et s'afficherait VIDE dans la liste de la
       * personne — une notification qu'on ne peut ni lire ni comprendre, et qu'on ne saurait pas
       * relier à son émetteur. L'erreur est levée plutôt que tolérée.
       */
      await expect(
        NotificationService.create({ userId: UTILISATEUR, type: 'INFO' } as any)
      ).rejects.toThrow(/Au moins un système/)

      expect(prismaMock.notification.create).not.toHaveBeenCalled()
    })

    it('accepte le texte libre seul, sans clé de traduction', async () => {
      // Les deux systèmes coexistent : un message d'administration n'a pas de clé i18n.
      await NotificationService.create({
        userId: UTILISATEUR,
        type: 'INFO',
        titleText: 'Titre libre',
        messageText: 'Message libre',
      } as any)

      expect(prismaMock.notification.create).toHaveBeenCalled()
    })
  })

  describe('les préférences de la personne', () => {
    it('n’écrit RIEN quand la préférence refuse', async () => {
      /*
       * Et rend `null`, ce qui compte pour les appelants : `safeNotify` et les aides du fichier
       * traitent `null` comme « rien à faire ». Écrire la ligne « au cas où » ferait réapparaître
       * dans la liste ce que la personne a explicitement coupé.
       */
      autoriseEnApplication.mockResolvedValue(false)

      const resultat = await NotificationService.create(donnees)

      expect(resultat).toBeNull()
      expect(prismaMock.notification.create).not.toHaveBeenCalled()
      expect(pousserEnTempsReel).not.toHaveBeenCalled()
      expect(pousserEnPush).not.toHaveBeenCalled()
    })

    it('ne consulte AUCUNE préférence sans `notificationType`', async () => {
      /*
       * Choix du service, à connaître : une notification sans type n'est pas filtrée. C'est la
       * porte de sortie pour les messages qu'on ne veut pas laisser couper — mais c'est aussi
       * comment un oubli de `notificationType` rend un réglage sans effet.
       */
      await NotificationService.create({
        userId: UTILISATEUR,
        type: 'INFO',
        titleText: 'Sans type',
        messageText: 'Sans type',
      } as any)

      expect(autoriseEnApplication).not.toHaveBeenCalled()
      expect(prismaMock.notification.create).toHaveBeenCalled()
    })
  })

  describe('le push, dans la langue de la personne', () => {
    it('traduit le titre et le message selon `preferredLanguage`', async () => {
      /*
       * La langue vient de l'UTILISATEUR chargé avec la notification, pas de l'appelant. Une
       * notification créée par un organisateur français doit partir en néerlandais si c'est la
       * langue de son destinataire.
       */
      await NotificationService.create(donnees)

      expect(pousserEnPush).toHaveBeenCalledTimes(1)
      const charge = pousserEnPush.mock.calls[0][1] as any
      // La vraie valeur néerlandaise, et non « ce n'est pas du français » : seule une égalité
      // exacte prouve que c'est bien CETTE langue qui a été choisie.
      expect(charge.title).toBe('Je plaats is verwijderd')
      expect(charge.message).not.toMatch(/^notifications\./)
      // Les paramètres sont substitués : des accolades restantes seraient lisibles et fausses.
      expect(charge.message).not.toMatch(/\{[a-zA-Z]+\}/)
      expect(charge.message).toContain('Camille')
      expect(charge.message).toContain('Lyon')
    })

    it('retombe sur le français sans langue choisie', async () => {
      prismaMock.notification.create.mockResolvedValue({
        ...notificationCreee,
        user: { ...notificationCreee.user, preferredLanguage: null },
      })

      await NotificationService.create(donnees)

      const charge = pousserEnPush.mock.calls[0][1] as any
      expect(charge.title).toBe('Votre place a été retirée')
    })

    it('emploie le texte libre quand il n’y a pas de clé', async () => {
      prismaMock.notification.create.mockResolvedValue({
        ...notificationCreee,
        titleKey: null,
        messageKey: null,
        titleText: 'Titre libre',
        messageText: 'Message libre',
      })

      await NotificationService.create({
        userId: UTILISATEUR,
        type: 'INFO',
        titleText: 'Titre libre',
        messageText: 'Message libre',
      } as any)

      const charge = pousserEnPush.mock.calls[0][1] as any
      expect(charge.title).toBe('Titre libre')
      expect(charge.message).toBe('Message libre')
    })
  })

  describe('la notification survit à l’échec de chaque canal', () => {
    /**
     * ⚠️ TROIS TESTS ET NON UN, et la distinction n'est pas décorative : un seul `try/catch`
     * autour des trois envois laisserait le deuxième et le troisième MUETS dès que le premier
     * échoue. Un test unique sur « le premier échoue » resterait vert dans cette configuration.
     * Éprouver chaque canal séparément est le seul moyen de vérifier qu'ils sont indépendants.
     */

    it('le temps réel échoue → la notification existe quand même', async () => {
      pousserEnTempsReel.mockRejectedValue(new Error('aucun flux ouvert'))

      const resultat = await NotificationService.create(donnees)

      expect(resultat).toBeTruthy()
      expect(prismaMock.notification.create).toHaveBeenCalled()
      // Et le canal SUIVANT a bien été tenté : c'est ce qu'un `try` unique casserait.
      expect(pousserEnPush).toHaveBeenCalled()
    })

    it('le push échoue → la notification existe quand même', async () => {
      pousserEnPush.mockRejectedValue(new Error('FCM indisponible'))

      const resultat = await NotificationService.create(donnees)

      expect(resultat).toBeTruthy()
    })

    it('le courriel échoue → la notification existe quand même', async () => {
      autoriseParCourriel.mockResolvedValue(true)
      envoyerCourriel.mockRejectedValue(new Error('SMTP injoignable'))

      const resultat = await NotificationService.create(donnees)

      expect(resultat).toBeTruthy()
    })
  })

  describe('ce qui est écrit en base', () => {
    it('recopie les métadonnées qui servent au regroupement', async () => {
      /*
       * `entityType` et `entityId` portent l'index composite ajouté par serveur-transverse-o2, et
       * c'est par eux que la fusion de comptes retrouve les notifications d'une entité. Les
       * omettre ne casserait rien à l'affichage — et laisserait des lignes orphelines qu'aucune
       * requête ne retrouve.
       */
      await NotificationService.create(donnees)

      expect(prismaMock.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: UTILISATEUR,
            type: 'INFO',
            category: 'carpool',
            entityType: 'CarpoolOffer',
            entityId: '1',
          }),
        })
      )
    })

    it('charge la langue du destinataire avec la notification', async () => {
      /*
       * Le test qui protège le push. Sans `preferredLanguage` à l'`include`, Prisma rend
       * `undefined`, le repli lit « pas de langue choisie », et TOUT LE MONDE reçoit du français —
       * sans qu'aucune erreur ne le dise. Le mock de Prisma ignorant le `select`, seule une
       * assertion sur la forme de la requête voit ce défaut.
       */
      await NotificationService.create(donnees)

      const appel = prismaMock.notification.create.mock.calls[0][0]
      expect(appel.include.user.select.preferredLanguage).toBe(true)
    })
  })
})
