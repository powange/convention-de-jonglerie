import {
  TAILLES_ICONE,
  adresseApplication,
  sourceIcone,
  versionIcone,
} from '../../../utils/application-evenement'
import { resoudreEvenement } from '../../../utils/evenement-public'

import { optionalAuth } from '#server/utils/auth-utils'

/**
 * Le manifeste de l'application d'UN événement : celui que les pages de l'événement déclarent à la
 * place de celui de Flowvent, si bien qu'« Installer » depuis l'une d'elles pose sur le téléphone
 * une application à son nom, limitée à son adresse.
 *
 * - `scope` : l'adresse de l'événement. Ce qui en sort (accueil, tarifs, tableau de bord) s'ouvre
 *   hors de l'application.
 * - `id` : propre à l'événement, distinct de celui de Flowvent : les deux s'installent côte à côte,
 *   comme plusieurs événements.
 *
 * Visible selon la règle de `resoudreEvenement`, comme la page publique : la page le demande AVEC
 * les cookies (`crossorigin="use-credentials"`), pour qu'un bénévole ou un organisateur installe
 * aussi un événement qui n'est pas public. Sinon 404.
 */
export default defineEventHandler(async (event) => {
  const user = optionalAuth(event)
  const resolu = await resoudreEvenement(
    String(getRouterParam(event, 'id') ?? ''),
    user?.id ?? null
  )
  if (!resolu) throw createError({ status: 404, message: 'Événement introuvable' })

  const e = await prisma.event.findUniqueOrThrow({
    where: { id: resolu.id },
    select: { publicId: true, name: true, appIconUrl: true, imageUrl: true },
  })

  // Les environnements de test se distinguent à l'écran d'accueil, comme Flowvent lui-même.
  const nodeEnv = process.env.NODE_ENV
  const nuxtEnv = process.env.NUXT_ENV || nodeEnv
  const suffixe = nodeEnv === 'development' ? ' DEV' : nuxtEnv === 'release' ? ' TEST' : ''
  const themeColor =
    nodeEnv === 'development' ? '#ef4444' : nuxtEnv === 'release' ? '#f59e0b' : '#1c1917'

  const source = sourceIcone(e)
  const base = `/api/events/${e.publicId}/application/icone`
  const icons = source
    ? [
        ...TAILLES_ICONE.map((t) => ({
          src: `${base}?taille=${t}&v=${versionIcone(source)}`,
          sizes: `${t}x${t}`,
          type: 'image/png',
          purpose: 'any',
        })),
        {
          src: `${base}?taille=512&masquable=1&v=${versionIcone(source)}`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ]
    : [
        {
          src: '/favicons/android-chrome-192x192.png?v=v1',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/favicons/android-chrome-512x512.png?v=v1',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/favicons/android-chrome-maskable-512x512.png?v=v1',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ]

  setHeader(event, 'Content-Type', 'application/manifest+json; charset=utf-8')
  // Jamais en cache partagé : il dépend de la session (événement non public).
  setHeader(event, 'Cache-Control', 'private, no-cache')
  return {
    id: adresseApplication(e.publicId),
    name: `${e.name}${suffixe}`,
    short_name: `${e.name}${suffixe}`,
    description: `L'application de ${e.name}, sur Flowvent.`,
    lang: 'fr',
    start_url: adresseApplication(e.publicId),
    scope: `/events/${e.publicId}/`,
    display: 'standalone',
    orientation: 'any',
    theme_color: themeColor,
    background_color: '#1c1917',
    icons,
  }
})
