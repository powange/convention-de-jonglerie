import { describe, it, expect, vi, beforeEach } from 'vitest'

const envoyerCourriel = vi.hoisted(() => vi.fn(async () => true))
const composerCourriel = vi.hoisted(() => vi.fn(async () => '<html></html>'))
const pousserAuCompte = vi.hoisted(() => vi.fn(async () => true))
const prevenirEnDirect = vi.hoisted(() => vi.fn(async () => true))

vi.mock('../../../../server/utils/emailService', () => ({
  sendEmail: envoyerCourriel,
  generateNotificationEmailHtml: composerCourriel,
}))

vi.mock('../../../../server/utils/notification-stream-manager', () => ({
  notificationStreamManager: { notifyUser: prevenirEnDirect },
}))

vi.mock('../../../../server/utils/unified-push-service', () => ({
  unifiedPushService: { sendToUser: pousserAuCompte },
}))

import { NotificationService } from '../../../../server/utils/notification-service'

const prismaMock = (globalThis as any).prisma

/**
 * Ce que `NotificationService.create` décide, et qui n'était éprouvé nulle part.
 *
 * ⚠️ POURQUOI C'EST LA FONCTION LA PLUS COÛTEUSE À LAISSER SANS TEST. Elle est le passage obligé
 * de toutes les notifications du dépôt — une trentaine d'appels —, et elle prend TROIS décisions
 * qu'aucune erreur ne signale :
 *
 *   1. respecter la préférence de l'utilisateur, ou le prévenir malgré son refus ;
 *   2. n'envoyer un courriel que si la préférence d'e-mail est cochée, l'inverse étant du
 *      démarchage ;
 *   3. traduire dans la langue du destinataire, faute de quoi un bénévole néerlandais lit du
 *      français sur son écran de verrouillage.
 *
 * Aucune de ces trois-là ne lève : on obtient une notification, elle part, et personne ne sait
 * qu'elle n'aurait pas dû — ou qu'elle est partie dans la mauvaise langue.
 *
 * 🔬 LES PRÉFÉRENCES NE SONT PAS MOCKÉES : `notification-preferences.ts` tourne pour de vrai,
 * au-dessus du mock de Prisma. Mocker `isNotificationAllowed` aurait éprouvé le mock, et laissé
 * passer une clé de préférence mal déduite — précisément le genre de défaut dont il s'agit ici.
 *
 * 🔬 `translateServerSide` NON PLUS n'est pas mocké : il lit les vrais fichiers de
 * `apps/app1/i18n/locales`. Une clé manquante rend la clé elle-même, ce que ces tests attrapent.
 */

const UTILISATEUR = 7

/** Un compte, ses préférences et sa langue — le mock de Prisma ignorant les `select`. */
const compte = (
  preferences: Record<string, boolean> | null,
  preferredLanguage = 'fr',
  email = 'benevole@exemple.test'
) => ({
  id: UTILISATEUR,
  email,
  prenom: 'Alex',
  pseudo: 'Alex',
  preferredLanguage,
  notificationPreferences: preferences,
})

const notificationEnBase = (preferredLanguage = 'fr') => ({
  id: 'notif-1',
  userId: UTILISATEUR,
  type: 'SUCCESS',
  titleKey: 'notifications.volunteer.application_accepted.title',
  messageKey: 'notifications.volunteer.application_accepted.message',
  translationParams: { editionName: 'Édition 2026' },
  actionTextKey: null,
  titleText: null,
  messageText: null,
  actionText: null,
  category: 'volunteer',
  actionUrl: '/editions/1',
  user: { id: UTILISATEUR, pseudo: 'Alex', email: 'benevole@exemple.test', preferredLanguage },
})

/** L'appel demandé : une candidature acceptée, donc la préférence `applicationUpdates`. */
const demande = {
  userId: UTILISATEUR,
  type: 'SUCCESS' as const,
  titleKey: 'notifications.volunteer.application_accepted.title',
  messageKey: 'notifications.volunteer.application_accepted.message',
  translationParams: { editionName: 'Édition 2026' },
  category: 'volunteer',
  actionUrl: '/editions/1',
  notificationType: 'volunteer_application_accepted' as const,
}

describe('NotificationService.create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.notification.create.mockResolvedValue(notificationEnBase())
    prismaMock.user.findUnique.mockResolvedValue(compte(null))
  })

  describe('la préférence de l’utilisateur', () => {
    it('BLOQUE tout quand la préférence est décochée', async () => {
      /*
       * 🔬 L'assertion centrale. Le refus doit intervenir AVANT la création en base : une
       * notification créée puis simplement non poussée s'accumulerait dans la cloche de quelqu'un
       * qui a demandé à ne plus en recevoir.
       */
      prismaMock.user.findUnique.mockResolvedValue(compte({ applicationUpdates: false }))

      const resultat = await NotificationService.create(demande)

      expect(resultat).toBeNull()
      expect(prismaMock.notification.create).not.toHaveBeenCalled()
      expect(pousserAuCompte).not.toHaveBeenCalled()
      expect(envoyerCourriel).not.toHaveBeenCalled()
    })

    it('laisse passer quand la préférence est cochée', async () => {
      prismaMock.user.findUnique.mockResolvedValue(compte({ applicationUpdates: true }))

      const resultat = await NotificationService.create(demande)

      expect(resultat).not.toBeNull()
      expect(pousserAuCompte).toHaveBeenCalledTimes(1)
    })

    it('laisse passer par DÉFAUT un compte qui n’a rien réglé', async () => {
      // La colonne est nulle pour la grande majorité des comptes : le silence vaut accord.
      prismaMock.user.findUnique.mockResolvedValue(compte(null))

      expect(await NotificationService.create(demande)).not.toBeNull()
    })

    it('lit la BONNE préférence, et pas une voisine', async () => {
      /*
       * ⚠️ `volunteer_application_accepted` est mappé sur `applicationUpdates`, PAS sur
       * `volunteerReminders` — deux clés proches, dont l'une concerne les rappels de créneaux. Une
       * confusion entre les deux couperait les candidatures de qui a seulement refusé les rappels,
       * et les deux tests précédents resteraient verts.
       */
      prismaMock.user.findUnique.mockResolvedValue(
        compte({ applicationUpdates: true, volunteerReminders: false, systemNotifications: false })
      )

      expect(await NotificationService.create(demande)).not.toBeNull()
    })

    it('ne filtre RIEN quand l’appel ne déclare pas de type', async () => {
      // Sans `notificationType`, il n'y a pas de préférence à consulter : la notification passe.
      prismaMock.user.findUnique.mockResolvedValue(compte({ applicationUpdates: false }))

      const { notificationType: _sansType, ...sansType } = demande

      expect(await NotificationService.create(sansType)).not.toBeNull()
    })
  })

  describe('le courriel', () => {
    it('N’ENVOIE RIEN par défaut — c’est le réglage d’usine', async () => {
      /*
       * ⚠️ Les préférences d'e-mail sont à `false` par défaut, volontairement. Un défaut inversé
       * enverrait un courriel par notification à toute la base, sans que personne ne l'ait demandé.
       */
      prismaMock.user.findUnique.mockResolvedValue(compte({ applicationUpdates: true }))

      await NotificationService.create(demande)

      expect(envoyerCourriel).not.toHaveBeenCalled()
    })

    it('envoie quand la préférence d’e-mail est cochée', async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        compte({ applicationUpdates: true, emailApplicationUpdates: true })
      )

      await NotificationService.create(demande)

      expect(envoyerCourriel).toHaveBeenCalledTimes(1)
      expect(envoyerCourriel.mock.calls[0][0]).toMatchObject({ to: 'benevole@exemple.test' })
    })

    it('n’envoie rien à un compte SANS adresse', async () => {
      // Un compte fusionné ou anonymisé peut ne plus en avoir : `sendEmail` avec `to: null`
      // échouerait côté transport, bien après.
      prismaMock.user.findUnique.mockResolvedValue(
        compte({ applicationUpdates: true, emailApplicationUpdates: true }, 'fr', '')
      )

      await NotificationService.create(demande)

      expect(envoyerCourriel).not.toHaveBeenCalled()
    })

    it('un échec d’envoi ne fait PAS échouer la notification', async () => {
      /*
       * La notification est déjà en base et déjà poussée quand le courriel part. Laisser
       * l'exception remonter ferait échouer l'opération appelante — accepter une candidature, par
       * exemple — pour un serveur de courriel indisponible.
       */
      prismaMock.user.findUnique.mockResolvedValue(
        compte({ applicationUpdates: true, emailApplicationUpdates: true })
      )
      envoyerCourriel.mockRejectedValueOnce(new Error('SMTP injoignable'))

      expect(await NotificationService.create(demande)).not.toBeNull()
    })
  })

  describe('la langue du destinataire', () => {
    it('traduit le push dans SA langue, pas celle du code', async () => {
      /*
       * 🔬 Le test qui prouve la traduction plutôt que de la supposer : on compare deux langues.
       * Un titre écrit en français dans le code passerait un test rédigé avec un seul destinataire
       * francophone.
       */
      prismaMock.notification.create.mockResolvedValue(notificationEnBase('nl'))
      prismaMock.user.findUnique.mockResolvedValue(compte({ applicationUpdates: true }, 'nl'))

      await NotificationService.create(demande)

      const pousse = pousserAuCompte.mock.calls[0][1] as { title: string; message: string }
      expect(pousse.title).toBe('Vrijwilligersaanmelding geaccepteerd! ✅')
      expect(pousse.message).toContain('Édition 2026')
    })

    it('substitue les paramètres, jamais laissés en accolades', async () => {
      prismaMock.user.findUnique.mockResolvedValue(compte({ applicationUpdates: true }))

      await NotificationService.create(demande)

      const pousse = pousserAuCompte.mock.calls[0][1] as { message: string }
      expect(pousse.message).toBe(
        'Votre candidature de bénévole pour "Édition 2026" a été acceptée.'
      )
      expect(pousse.message).not.toContain('{')
    })

    it('traduit aussi le SUJET du courriel', async () => {
      // Le sujet est la seule chose visible dans une boîte de réception : le laisser en français
      // annule tout le reste.
      prismaMock.notification.create.mockResolvedValue(notificationEnBase('nl'))
      prismaMock.user.findUnique.mockResolvedValue(
        compte({ applicationUpdates: true, emailApplicationUpdates: true }, 'nl')
      )

      await NotificationService.create(demande)

      expect(envoyerCourriel.mock.calls[0][0]).toMatchObject({
        subject: 'Vrijwilligersaanmelding geaccepteerd! ✅',
      })
    })

    it('se replie sur le français quand aucune langue n’est choisie', async () => {
      prismaMock.notification.create.mockResolvedValue({
        ...notificationEnBase(),
        user: { ...notificationEnBase().user, preferredLanguage: null },
      })
      prismaMock.user.findUnique.mockResolvedValue(compte({ applicationUpdates: true }, ''))

      await NotificationService.create(demande)

      const pousse = pousserAuCompte.mock.calls[0][1] as { title: string }
      expect(pousse.title).toBe('Candidature bénévole acceptée ! ✅')
    })
  })

  describe('ce qui ne doit pas faire échouer l’appelant', () => {
    it('refuse un appel sans clé NI texte', async () => {
      // Une notification vide serait une ligne muette dans la cloche de quelqu'un.
      await expect(
        NotificationService.create({ userId: UTILISATEUR, type: 'INFO' } as never)
      ).rejects.toThrow(/Au moins un système/)
    })

    it('un échec du direct ne fait pas échouer la création', async () => {
      prismaMock.user.findUnique.mockResolvedValue(compte({ applicationUpdates: true }))
      prevenirEnDirect.mockRejectedValueOnce(new Error('flux fermé'))

      expect(await NotificationService.create(demande)).not.toBeNull()
    })

    it('un échec du push ne fait pas échouer la création', async () => {
      prismaMock.user.findUnique.mockResolvedValue(compte({ applicationUpdates: true }))
      pousserAuCompte.mockRejectedValueOnce(new Error('FCM injoignable'))

      expect(await NotificationService.create(demande)).not.toBeNull()
    })
  })
})
