import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { searchBackups, validateSearchRequest } from '#server/utils/backup-search'

const querySchema = z.object({
  table: z.string().min(1),
  // Colonnes à ramener, séparées par des virgules (les identifiants SQL n'en contiennent pas)
  columns: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(',')
        .map((column) => column.trim())
        .filter(Boolean)
    ),
  filterColumn: z.string().min(1).optional(),
  filterValue: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

/** Les lignes SQL peuvent contenir des types que JSON ignore (Date, Buffer, BigInt). */
const serializeRow = (row: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (value instanceof Date) return [key, value.toISOString()]
      if (Buffer.isBuffer(value)) return [key, `<binaire ${value.length} octets>`]
      if (typeof value === 'bigint') return [key, Number(value)]
      return [key, value]
    })
  )

/**
 * GET /api/admin/backup/search
 * Recherche la valeur d'un champ dans chaque sauvegarde, en SSE : chaque sauvegarde
 * interrogée donne lieu à un événement, du plus récent au plus ancien.
 */
export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const request = querySchema.parse(getQuery(event))
    // Échoue tôt (400) sur une table ou une colonne inconnue, avant d'ouvrir le flux
    validateSearchRequest(request)

    setHeader(event, 'Content-Type', 'text/event-stream')
    setHeader(event, 'Cache-Control', 'no-cache')
    setHeader(event, 'Connection', 'keep-alive')
    // Sans cela, un proxy peut retenir les événements jusqu'à la fin du flux
    setHeader(event, 'X-Accel-Buffering', 'no')

    return new ReadableStream({
      start(controller) {
        const state = { aborted: false, closed: false }
        let pingInterval: ReturnType<typeof setInterval> | null = null

        const push = (payload: unknown) => {
          if (state.closed) return
          try {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`))
          } catch (error) {
            console.error('[BACKUP-SEARCH] Envoi SSE impossible:', error)
            state.closed = true
          }
        }

        const close = () => {
          if (pingInterval) {
            clearInterval(pingInterval)
            pingInterval = null
          }
          if (state.closed) return
          state.closed = true
          try {
            controller.close()
          } catch {
            // déjà fermé
          }
        }

        const onDisconnect = () => {
          state.aborted = true
          close()
        }
        event.node.req.on('close', onDisconnect)
        event.node.req.on('aborted', onDisconnect)
        ;(async () => {
          try {
            push({ type: 'connected', table: request.table })

            // Une sauvegarde volumineuse peut occuper la recherche plusieurs dizaines de
            // secondes sans rien émettre ; sans ce battement, un proxy coupe le flux.
            pingInterval = setInterval(() => {
              if (!state.closed && !state.aborted) push({ type: 'ping' })
            }, 10000)

            let matches = 0
            let scanned = 0

            for await (const result of searchBackups(request, { signal: state })) {
              scanned += 1
              if (result.rows.length > 0) matches += 1

              push({
                type: 'result',
                filename: result.filename,
                createdAt: result.createdAt,
                rows: result.rows.map(serializeRow),
                tableMissing: result.tableMissing,
                error: result.error,
                progress: { current: result.index + 1, total: result.total },
              })
            }

            if (!state.aborted) {
              push({ type: 'done', scanned, matches })
            }
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Erreur inconnue'
            console.error(`[BACKUP-SEARCH] Échec: ${message}`)
            push({ type: 'error', message })
          } finally {
            // Court délai pour laisser partir le dernier événement
            setTimeout(close, 100)
          }
        })()
      },
    })
  },
  { operationName: 'SearchBackups' }
)
