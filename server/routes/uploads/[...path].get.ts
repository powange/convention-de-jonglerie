import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'

export default defineEventHandler(async (event) => {
  // Récupérer le chemin depuis l'URL
  const path = getRouterParam(event, 'path')

  if (!path) {
    throw createError({
      status: 400,
      message: 'Path is required',
    })
  }

  // Construire le chemin complet du fichier
  // nuxt-file-storage stocke dans le mount configuré
  const uploadDir = process.env.NUXT_FILE_STORAGE_MOUNT || '/uploads'
  const filePath = join(uploadDir, path)

  // Vérifier que le fichier existe
  try {
    const stats = await stat(filePath)

    if (!stats.isFile()) {
      throw createError({
        status: 404,
        message: 'File not found',
      })
    }

    // Déterminer le type MIME basé sur l'extension
    const ext = path.split('.').pop()?.toLowerCase()
    let contentType = 'application/octet-stream'

    switch (ext) {
      case 'jpg':
      case 'jpeg':
        contentType = 'image/jpeg'
        break
      case 'png':
        contentType = 'image/png'
        break
      case 'webp':
        contentType = 'image/webp'
        break
      case 'gif':
        contentType = 'image/gif'
        break
      case 'svg':
        contentType = 'image/svg+xml'
        break
    }

    // Définir les headers
    setHeader(event, 'Content-Type', contentType)
    setHeader(event, 'Content-Length', stats.size.toString())
    setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')

    // Retourner le fichier
    return sendStream(event, createReadStream(filePath))
  } catch {
    // Si le fichier n'existe pas, essayer dans public/uploads (ancien système)
    try {
      const publicPath = join(process.cwd(), 'public/uploads', path)
      const publicStats = await stat(publicPath)

      if (publicStats.isFile()) {
        const ext = path.split('.').pop()?.toLowerCase()
        let contentType = 'application/octet-stream'

        switch (ext) {
          case 'jpg':
          case 'jpeg':
            contentType = 'image/jpeg'
            break
          case 'png':
            contentType = 'image/png'
            break
          case 'webp':
            contentType = 'image/webp'
            break
        }

        setHeader(event, 'Content-Type', contentType)
        setHeader(event, 'Content-Length', publicStats.size.toString())
        setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')

        return sendStream(event, createReadStream(publicPath))
      }
    } catch {
      // Fichier non trouvé
    }

    throw createError({
      status: 404,
      message: 'File not found',
    })
  }
})
