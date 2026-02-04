import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { join } from 'path'

import { sendStream } from 'h3'

import { wrapApiHandler } from '#server/utils/api-helpers'

export default wrapApiHandler(
  async (event) => {
    // Récupérer le chemin depuis l'URL
    const path = getRouterParam(event, 'path')

    if (!path) {
      throw createError({
        status: 400,
        message: 'Invalid path',
      })
    }

    // Vérifier les tentatives de path traversal AVANT la normalisation
    if (path.includes('..') || path.includes('//')) {
      throw createError({
        status: 403,
        message: 'Access denied',
      })
    }

    // Construire le chemin complet du fichier
    const filePath = join(process.cwd(), 'public', 'uploads', path)

    // Vérifier que le chemin ne sort pas du dossier uploads (sécurité)
    const normalizedPath = join(process.cwd(), 'public', 'uploads', path)
    const uploadsDir = join(process.cwd(), 'public', 'uploads')

    if (!normalizedPath.startsWith(uploadsDir)) {
      throw createError({
        status: 403,
        message: 'Access denied',
      })
    }

    // Vérifier que le fichier existe
    try {
      const stats = await stat(filePath)
      if (!stats.isFile()) {
        throw new Error('Not a file')
      }
    } catch {
      throw createError({
        status: 404,
        message: 'File not found',
      })
    }

    // Déterminer le type MIME en fonction de l'extension
    const ext = filePath.split('.').pop()?.toLowerCase()
    let contentType = 'application/octet-stream'

    switch (ext) {
      case 'jpg':
      case 'jpeg':
        contentType = 'image/jpeg'
        break
      case 'png':
        contentType = 'image/png'
        break
      case 'gif':
        contentType = 'image/gif'
        break
      case 'webp':
        contentType = 'image/webp'
        break
      case 'svg':
        contentType = 'image/svg+xml'
        break
    }

    // Définir les headers
    setHeader(event, 'Content-Type', contentType)
    setHeader(event, 'Cache-Control', 'public, max-age=31536000') // Cache d'un an

    // Créer un stream et l'envoyer
    const stream = createReadStream(filePath)
    return sendStream(event, stream)
  },
  { operationName: 'ServeUploadedFile' }
)
