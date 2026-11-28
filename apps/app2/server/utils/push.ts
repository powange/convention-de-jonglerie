/**
 * Notifications push de Flowvent, en Web Push standard (clés VAPID, paquet `web-push`) : pas de
 * service tiers, et le contenu est chiffré de bout en bout — le service de push du navigateur
 * (Google, Mozilla, Apple) le transporte sans pouvoir le lire.
 *
 * Sans `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`, le push est désactivé sans erreur : la cloche
 * reste, rien ne part. Une paire de clés par environnement (cf. .env.example).
 *
 * Ce module ne lève jamais : un échec d'envoi ne doit pas faire échouer l'opération qui a créé la
 * notification. Un abonnement que le service refuse (404 / 410 : application désinstallée,
 * permission retirée) est supprimé.
 */
import webpush from 'web-push'

import { versionIcone } from './application-evenement'
import { estUnNumero } from './evenement-public'

let configure: boolean | null = null

/** Configure `web-push` une fois ; faux si les clés manquent. */
function pret(): boolean {
  if (configure !== null) return configure
  const publique = process.env.VAPID_PUBLIC_KEY
  const privee = process.env.VAPID_PRIVATE_KEY
  if (!publique || !privee) {
    console.warn('[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY absentes : push désactivé')
    configure = false
    return false
  }
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://flowvent.org', publique, privee)
    configure = true
  } catch (erreur) {
    console.error('[push] clés VAPID invalides, push désactivé :', erreur)
    configure = false
  }
  return configure
}

/** La clé publique que le navigateur présente pour s'abonner, ou `null` si le push est éteint. */
export function clePubliquePush(): string | null {
  return pret() ? process.env.VAPID_PUBLIC_KEY! : null
}

/** Ce que reçoit le service worker (server/routes/sw.js.ts), qui l'affiche. */
export interface ContenuPush {
  titre: string
  message: string
  /** La page ouverte au toucher. */
  url: string
  /** Icône de la notification : celle de l'application de l'événement, sinon celle de Flowvent. */
  icone?: string
  /** Grande image (Android, Chrome sur ordinateur). */
  image?: string
  /** Une notification de même étiquette remplace la précédente au lieu de s'empiler. */
  tag?: string
  /** Boutons, chacun vers sa page (Android, Chrome et Edge sur ordinateur). */
  actions?: { action: string; titre: string; url: string }[]
}

/**
 * Envoie à tous les appareils abonnés du compte. Rend le nombre d'envois réussis (0 si le push est
 * éteint ou si le compte n'a aucun appareil).
 */
export async function envoyerPush(userId: number, contenu: ContenuPush): Promise<number> {
  if (!pret()) return 0
  const abonnements = await prisma.pushSubscription.findMany({ where: { userId } })
  if (!abonnements.length) return 0

  const charge = JSON.stringify(contenu)
  let reussis = 0
  await Promise.all(
    abonnements.map(async (a) => {
      try {
        await webpush.sendNotification(
          { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
          charge,
          // Une journée : au-delà, une notification de créneau ou d'échange a perdu son sens.
          { TTL: 24 * 60 * 60, urgency: 'normal' }
        )
        reussis++
        await prisma.pushSubscription
          .update({ where: { id: a.id }, data: { lastSuccessAt: new Date() } })
          .catch(() => null)
      } catch (erreur) {
        const statut = (erreur as { statusCode?: number }).statusCode
        if (statut === 404 || statut === 410) {
          // L'abonnement n'existe plus chez le service de push : on l'oublie.
          await prisma.pushSubscription.delete({ where: { id: a.id } }).catch(() => null)
        } else {
          console.warn(`[push] envoi refusé (${statut ?? 'réseau'}) pour l'abonnement ${a.id}`)
        }
      }
    })
  )
  return reussis
}

/** L'événement désigné par une adresse `/events/<ref>/…` ou `/editions/<id>/…`, s'il y en a un. */
function refDansLAdresse(url: string | null | undefined): string | null {
  const m = /^\/(?:events|editions)\/([^/?#]+)/.exec(url ?? '')
  return m && m[1] !== 'new' ? m[1]! : null
}

/**
 * Le contenu push d'une notification de la cloche : son texte, sa page — réécrite avec
 * l'identifiant public de l'événement, pour qu'elle s'ouvre DANS l'application de l'événement
 * installée (dont l'adresse est `/events/<publicId>/`) — et l'icône de cet événement.
 */
export async function contenuPushDeNotification(n: {
  id: string
  titleText: string | null
  titleKey: string | null
  messageText: string | null
  messageKey: string | null
  actionText: string | null
  actionUrl: string | null
  entityType: string | null
  entityId: string | null
}): Promise<ContenuPush> {
  let url = n.actionUrl || '/'
  let icone = '/favicons/android-chrome-192x192.png?v=v1'

  const ref =
    refDansLAdresse(n.actionUrl) ??
    ((n.entityType === 'Event' || n.entityType === 'Edition') && n.entityId ? n.entityId : null)
  if (ref) {
    const e = await prisma.event
      .findUnique({
        where: estUnNumero(ref) ? { id: Number(ref) } : { publicId: ref },
        select: { publicId: true, appIconUrl: true, imageUrl: true },
      })
      .catch(() => null)
    if (e) {
      url = url.replace(/^\/(?:events|editions)\/[^/?#]+/, `/events/${e.publicId}`)
      const source = e.appIconUrl || e.imageUrl
      if (source) {
        icone = `/api/events/${e.publicId}/application/icone?taille=192&v=${versionIcone(source)}`
      }
    }
  }

  return {
    titre: n.titleText || n.titleKey || 'Flowvent',
    message: n.messageText || n.messageKey || '',
    url,
    icone,
    tag: `notification-${n.id}`,
    actions: n.actionText ? [{ action: 'ouvrir', titre: n.actionText, url }] : [],
  }
}
