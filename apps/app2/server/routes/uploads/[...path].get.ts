import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Sert les fichiers déposés : `/uploads/<chemin>` → `<montage>/<chemin>` (volume `/uploads`).
 *
 * Plus étroit que la route d'app1 (apps/app1/server/routes/uploads/[...path].get.ts) : Flowvent ne
 * stocke que des photos de profil, publiques comme dans app1. On ne sert donc QUE ces dossiers et
 * ces formats — un autre chemin ou un SVG (porteur de script) répond 404.
 */
const DOSSIERS = /^(temp\/)?profiles\/\d+\/[A-Za-z0-9_-]+\.(jpe?g|png|webp)$/i

const TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export default defineEventHandler(async (event) => {
  const chemin = getRouterParam(event, 'path') ?? ''
  if (!DOSSIERS.test(chemin)) throw createError({ status: 404, message: 'Fichier introuvable' })

  const complet = join(process.env.NUXT_FILE_STORAGE_MOUNT || '/uploads', chemin)
  const infos = await stat(complet).catch(() => null)
  if (!infos?.isFile()) throw createError({ status: 404, message: 'Fichier introuvable' })

  setHeader(event, 'Content-Type', TYPES[chemin.split('.').pop()!.toLowerCase()]!)
  setHeader(event, 'Content-Length', infos.size)
  // Immuable : le nom change à chaque dépôt, et l'avatar ajoute `?v=` (cf. layers/ui avatar.ts).
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  return sendStream(event, createReadStream(complet))
})
