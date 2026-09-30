import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { defaultPreferences } from '#server/utils/notification-preferences'

const notificationPreferencesSchema = z.object({
  volunteerReminders: z.boolean(),
  applicationUpdates: z.boolean(),
  conventionNews: z.boolean(),
  systemNotifications: z.boolean(),
  carpoolUpdates: z.boolean(),
  artistUpdates: z.boolean(),
  /*
   * ⚠️ OPTIONNELLES, ET C'EST LE POINT. Les douze champs ci-dessus sont exigés : ajouter un
   * treizième champ obligatoire ferait rendre 400 à toute page des préférences OUVERTE AVANT le
   * déploiement, qui enverrait encore les douze anciens. La personne clique « Enregistrer » et lit
   * une erreur, sans rien avoir fait de mal.
   */
  messengerMessages: z.boolean().optional(),
  // Préférences email pour chaque type
  emailVolunteerReminders: z.boolean(),
  emailApplicationUpdates: z.boolean(),
  emailConventionNews: z.boolean(),
  emailSystemNotifications: z.boolean(),
  emailCarpoolUpdates: z.boolean(),
  emailArtistUpdates: z.boolean(),
  emailMessengerMessages: z.boolean().optional(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const body = await readBody(event)
    const preferences = notificationPreferencesSchema.parse(body)

    /*
     * ⚠️ ON FUSIONNE, ON NE REMPLACE PLUS. L'écriture écrasait la colonne entière par le corps
     * reçu : un client qui n'envoie pas `messengerMessages` — une page ouverte avant le
     * déploiement, ou un futur écran partiel — EFFAÇAIT le réglage au lieu de le laisser. Le
     * défaut étant `true`, la messagerie se rallumait toute seule chez qui l'avait coupée, sans
     * message et sans trace.
     *
     * `.optional()` du schéma laisse la clé ABSENTE quand elle n'est pas envoyée (et non à
     * `undefined`) : la diffusion ci-dessous ne l'écrase donc pas.
     */
    const existantes = await prisma.user.findUnique({
      where: { id: user.id },
      select: { notificationPreferences: true },
    })

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        notificationPreferences: {
          ...defaultPreferences,
          ...((existantes?.notificationPreferences as Record<string, unknown> | null) ?? {}),
          ...preferences,
        },
      },
      select: {
        id: true,
        notificationPreferences: true,
      },
    })

    return createSuccessResponse({ preferences: updatedUser.notificationPreferences })
  },
  { operationName: 'UpdateNotificationPreferences' }
)
