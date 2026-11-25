import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'

import type { H3Event } from 'h3'

import { getAuthSession } from '../../utils/session-helpers'

/**
 * Sert les fichiers déposés : `/uploads/<chemin>` → `<montage>/<chemin>` (volume `/uploads`).
 *
 * Plus étroit que la route d'app1 (apps/app1/server/routes/uploads/[...path].get.ts) : rien n'est
 * servi qui ne relève d'un DOMAINE déclaré ci-dessous, avec ses formats et sa règle de lecture. Un
 * autre chemin, un autre format (un SVG porte du script) → 404. Chaque module porté qui dépose des
 * fichiers ajoute ici son domaine — c'est la garde, pas une liste de commodité.
 *
 * **404 et non 403** sur un refus : un 403 confirmerait l'existence du fichier à qui n'a pas à la
 * connaître (même règle qu'app1).
 */

interface DomaineFichiers {
  /** Le chemin complet, extension comprise. Le groupe 1, s'il existe, est l'id de l'événement. */
  motif: RegExp
  /** `public`, ou qui peut lire (session exigée). */
  lecture: 'public' | ((eventId: number, userId: number, event: H3Event) => Promise<boolean>)
}

const IMAGES = '(jpe?g|png|webp)'

const DOMAINES: DomaineFichiers[] = [
  // Photos de profil, publiques comme dans app1 (dépôt dans temp/, puis profiles/<id>/).
  {
    motif: new RegExp(`^(?:temp/)?profiles/\\d+/[A-Za-z0-9_-]+\\.${IMAGES}$`, 'i'),
    lecture: 'public',
  },
]

const TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
}

export default defineEventHandler(async (event) => {
  const chemin = getRouterParam(event, 'path') ?? ''
  const introuvable = () => createError({ status: 404, message: 'Fichier introuvable' })
  if (chemin.includes('..') || chemin.includes('//')) throw introuvable()

  const domaine = DOMAINES.find((d) => d.motif.test(chemin))
  if (!domaine) throw introuvable()

  const prive = domaine.lecture !== 'public'
  if (domaine.lecture !== 'public') {
    const eventId = Number(chemin.match(domaine.motif)?.[1])
    const session = await getAuthSession(event)
    const userId = (session?.user as { id?: number } | undefined)?.id
    const autorise =
      userId && Number.isInteger(eventId) ? await domaine.lecture(eventId, userId, event) : false
    if (!autorise) throw introuvable()
  }

  const complet = join(process.env.NUXT_FILE_STORAGE_MOUNT || '/uploads', chemin)
  const infos = await stat(complet).catch(() => null)
  if (!infos?.isFile()) throw introuvable()

  const type = TYPES[chemin.split('.').pop()!.toLowerCase()]
  if (!type) throw introuvable()
  setHeader(event, 'Content-Type', type)
  setHeader(event, 'Content-Length', infos.size)
  // Immuable : le nom change à chaque dépôt (et l'avatar ajoute `?v=`, cf. layers/ui avatar.ts).
  // `private` derrière un droit : un cache partagé le servirait sinon à qui ne l'a pas.
  setHeader(
    event,
    'Cache-Control',
    prive ? 'private, max-age=3600' : 'public, max-age=31536000, immutable'
  )
  return sendStream(event, createReadStream(complet))
})
