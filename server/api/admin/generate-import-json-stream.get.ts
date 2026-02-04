import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { sendErrorEvent, sendResultEvent } from '@@/server/utils/import-generation-sse'
import { z } from 'zod'

import { runAgentExploration } from './generate-import-json-agent.post'
import { generateImportJson } from './generate-import-json.post'

import type { ImportGenerationEvent } from '@@/server/utils/import-generation-sse'

const querySchema = z.object({
  method: z.enum(['direct', 'agent']).default('direct'),
  urls: z.string().min(1), // URLs séparées par des virgules
  // Image trouvée lors du test (pour éviter de refaire une requête qui retourne une URL différente)
  previewedImageUrl: z.string().url().optional(),
  // Provider IA à utiliser (optionnel, utilise la config serveur par défaut)
  provider: z.enum(['lmstudio', 'anthropic', 'ollama']).optional(),
})

/**
 * GET /api/admin/generate-import-json-stream
 * Endpoint SSE unifié pour la génération d'import JSON
 *
 * Paramètres query:
 * - method: 'direct' (ED) ou 'agent' (EI)
 * - urls: URLs séparées par des virgules
 *
 * Exemple: /api/admin/generate-import-json-stream?method=direct&urls=https://example.com,https://example2.com
 */
export default wrapApiHandler(
  async (event) => {
    // Vérifier que l'utilisateur est un admin
    await requireGlobalAdminWithDbCheck(event)

    // Récupérer et valider les paramètres query
    const query = getQuery(event)
    const { method, urls: urlsString, previewedImageUrl, provider } = querySchema.parse(query)

    // Parser les URLs
    const urls = urlsString
      .split(',')
      .map((url) => url.trim())
      .filter((url) => url.length > 0)

    if (urls.length === 0) {
      throw createError({
        status: 400,
        message: 'Au moins une URL est requise',
      })
    }

    if (urls.length > 5) {
      throw createError({
        status: 400,
        message: 'Maximum 5 URLs autorisées',
      })
    }

    // Valider les URLs
    for (const url of urls) {
      try {
        new URL(url)
      } catch {
        throw createError({
          status: 400,
          message: `URL invalide: ${url}`,
        })
      }
    }

    console.log(
      `[GENERATE-STREAM] Démarrage SSE: method=${method}, urls=${urls.length}, provider=${provider || 'default'}`
    )

    // Configurer les headers SSE
    setHeader(event, 'Content-Type', 'text/event-stream')
    setHeader(event, 'Cache-Control', 'no-cache')
    setHeader(event, 'Connection', 'keep-alive')
    // Header pour désactiver le buffering des proxies (nginx, etc.)
    setHeader(event, 'X-Accel-Buffering', 'no')

    // Créer un ReadableStream pour SSE (pattern qui fonctionne)
    const stream = new ReadableStream({
      start(controller) {
        let isControllerClosed = false
        let isCancelled = false
        let pingInterval: ReturnType<typeof setInterval> | null = null

        const safeClose = () => {
          // Arrêter le ping
          if (pingInterval) {
            clearInterval(pingInterval)
            pingInterval = null
          }

          if (!isControllerClosed) {
            try {
              controller.close()
              isControllerClosed = true
            } catch {
              console.log('[GENERATE-STREAM] Controller déjà fermé')
            }
          }
        }

        // Fonction pour envoyer un message SSE
        const push = (data: string) => {
          if (isControllerClosed || isCancelled) {
            return
          }
          try {
            const sseData = `data: ${data}\n\n`
            controller.enqueue(new TextEncoder().encode(sseData))
          } catch (error) {
            console.error("[GENERATE-STREAM] Erreur lors de l'envoi:", error)
            isControllerClosed = true
          }
        }

        // Callback de progression SSE
        const onProgress = (progressEvent: ImportGenerationEvent) => {
          push(JSON.stringify(progressEvent))
        }

        // Envoyer un message de connexion initial
        push(JSON.stringify({ type: 'connected', method, urlCount: urls.length }))

        // Envoyer un premier ping après 1 seconde pour confirmer que le stream fonctionne
        setTimeout(() => {
          if (!isControllerClosed && !isCancelled) {
            push(JSON.stringify({ type: 'ping', timestamp: Date.now() }))
          }
        }, 1000)

        // Démarrer le ping périodique pour maintenir la connexion ouverte
        // Envoie un ping toutes les 10 secondes (certains proxies coupent après 30s d'inactivité)
        pingInterval = setInterval(() => {
          if (!isControllerClosed && !isCancelled) {
            push(JSON.stringify({ type: 'ping', timestamp: Date.now() }))
          }
        }, 10000)

        // Gestion de la déconnexion client
        const cleanup = () => {
          console.log('[GENERATE-STREAM] Client déconnecté')
          isCancelled = true
          safeClose()
        }

        event.node.req.on('close', cleanup)
        event.node.req.on('aborted', cleanup)

        // Lancer la génération de manière asynchrone
        ;(async () => {
          try {
            let result

            if (method === 'direct') {
              // Extraction Directe (ED)
              console.log('[GENERATE-STREAM] Lancement ED...')
              result = await generateImportJson(urls, { onProgress, previewedImageUrl, provider })
            } else {
              // Exploration Intelligente (EI)
              console.log('[GENERATE-STREAM] Lancement EI...')
              result = await runAgentExploration(urls, { onProgress, previewedImageUrl, provider })
            }

            // Ne pas envoyer si le client s'est déconnecté
            if (isCancelled) {
              console.log("[GENERATE-STREAM] Client déconnecté, abandon de l'envoi du résultat")
              return
            }

            // Envoyer le résultat final
            sendResultEvent(
              onProgress,
              result.success,
              result.json,
              result.provider,
              Array.isArray(result.urlsProcessed)
                ? result.urlsProcessed.length
                : result.urlsProcessed
            )

            console.log(`[GENERATE-STREAM] Génération terminée: success=${result.success}`)
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
            console.error(`[GENERATE-STREAM] Erreur: ${errorMessage}`)
            if (!isCancelled) {
              sendErrorEvent(onProgress, errorMessage)
            }
          } finally {
            // Fermer le stream après un court délai pour s'assurer que le dernier message est envoyé
            setTimeout(() => {
              safeClose()
            }, 100)
          }
        })()
      },

      cancel() {
        console.log('[GENERATE-STREAM] Stream annulé')
      },
    })

    return stream
  },
  { operationName: 'GenerateImportJsonStream' }
)
