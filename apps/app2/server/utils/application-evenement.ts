/**
 * L'application d'UN événement, installable sur un téléphone à part de Flowvent : son manifeste
 * n'ouvre que l'adresse de l'événement (`/events/<publicId>/`), et son écran de démarrage aiguille
 * chacun selon son rôle (`/events/<publicId>/app`).
 *
 * L'icône : celle que l'organisateur a déposée, sinon l'affiche recadrée, sinon celle de Flowvent.
 */
import { createHash } from 'node:crypto'

/** Les tailles d'icône que le manifeste annonce (celles qu'exigent Android et Chrome). */
export const TAILLES_ICONE = [192, 512] as const

/** L'image qui sert d'icône, ou `null` : on prend alors celles de Flowvent. */
export function sourceIcone(e: { appIconUrl: string | null; imageUrl: string | null }) {
  return e.appIconUrl || e.imageUrl || null
}

/**
 * Une empreinte courte de l'image source, pour l'URL des icônes : une icône changée change d'URL,
 * si bien qu'aucun cache (navigateur, Cloudflare) ne sert l'ancienne.
 */
export function versionIcone(source: string): string {
  return createHash('sha1').update(source).digest('hex').slice(0, 10)
}

/** L'adresse de démarrage de l'application de l'événement : l'aiguillage selon le rôle. */
export const adresseApplication = (publicId: string) => `/events/${publicId}/app`
