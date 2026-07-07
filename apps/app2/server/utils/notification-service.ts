/**
 * Service de notifications (no-op pour app2).
 *
 * app2 ne dispose pas de modèle `Notification`. On expose un objet compatible
 * avec l'API attendue par `layers/auth/` (seule `welcome` est appelée), toutes
 * les méthodes étant des no-op.
 */
export const NotificationHelpers = {
  /**
   * Notification de bienvenue — no-op (aucun modèle Notification dans app2).
   */
  async welcome(_userId: number): Promise<void> {
    // No-op
  },
}
