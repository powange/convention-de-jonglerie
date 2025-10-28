// Type pour les fonctions de push SSE
type SSEPushFunction = (message: string) => void

// Map pour stocker les connexions SSE par editionId
const sseConnections = new Map<number, Set<SSEPushFunction>>()

/**
 * Ajoute une connexion SSE pour une édition
 */
export function addSSEConnection(editionId: number, push: SSEPushFunction) {
  if (!sseConnections.has(editionId)) {
    sseConnections.set(editionId, new Set())
  }
  sseConnections.get(editionId)!.add(push)
  console.log(
    `[SSE] Client connecté à l'édition ${editionId}. Total: ${sseConnections.get(editionId)!.size}`
  )
}

/**
 * Retire une connexion SSE pour une édition
 */
export function removeSSEConnection(editionId: number, push: SSEPushFunction) {
  const connections = sseConnections.get(editionId)
  if (connections) {
    connections.delete(push)
    console.log(`[SSE] Client déconnecté de l'édition ${editionId}. Restants: ${connections.size}`)

    // Nettoyer le Set si vide
    if (connections.size === 0) {
      sseConnections.delete(editionId)
      console.log(`[SSE] Aucune connexion restante pour l'édition ${editionId}, nettoyage`)
    }
  }
}

/**
 * Diffuse un message à tous les clients connectés à une édition
 */
export function broadcastToEditionSSE(editionId: number, data: Record<string, any>) {
  const connections = sseConnections.get(editionId)
  if (!connections || connections.size === 0) {
    console.log(`[SSE] Aucun client connecté pour l'édition ${editionId}`)
    return
  }

  // h3's eventStream.push() gère automatiquement le formatage SSE (data: ... \n\n)
  // On envoie juste le JSON stringifié
  const message = JSON.stringify(data)
  console.log(
    `[SSE] Diffusion à ${connections.size} client(s) de l'édition ${editionId}:`,
    data.type
  )

  connections.forEach((push) => {
    try {
      push(message)
    } catch (error) {
      console.error("[SSE] Erreur lors de l'envoi:", error)
    }
  })
}

/**
 * Obtient le nombre de connexions actives pour une édition
 */
export function getSSEConnectionCount(editionId: number): number {
  return sseConnections.get(editionId)?.size || 0
}
