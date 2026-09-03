/**
 * Tâche planifiée : ferme les demandes d'échange devenues sans objet.
 *
 * Une demande expire dès que l'un des deux créneaux est passé — un échange ne sert plus à rien
 * une fois le service commencé. Ce délai a été préféré à une durée fixe, qui n'aurait été juste
 * pour aucune convention en particulier.
 *
 * Les endpoints refont ce contrôle avant d'agir : entre deux passages, une demande périmée
 * pourrait sinon être acceptée. Cette tâche n'est donc pas la garantie, seulement le ménage — sans
 * elle, les listes se rempliraient de demandes que plus personne ne peut traiter.
 */
export default defineTask({
  meta: {
    name: 'cleanup-expired-swaps',
    description: 'Close volunteer shift swap requests whose slots have passed',
  },
  async run() {
    try {
      const maintenant = new Date()

      const { count } = await prisma.volunteerSwapRequest.updateMany({
        where: {
          status: { in: ['PENDING_PEER', 'PENDING_MANAGER'] },
          // Le PREMIER des deux créneaux passés suffit : l'échange perd son objet dès qu'un des
          // deux services a commencé.
          OR: [
            { requesterAssignment: { timeSlot: { endDateTime: { lte: maintenant } } } },
            { targetAssignment: { timeSlot: { endDateTime: { lte: maintenant } } } },
          ],
        },
        data: { status: 'EXPIRED' },
      })

      console.log(`[CRON cleanup-expired-swaps] ${count} demande(s) d'échange expirée(s)`)

      return { success: true, expired: count, timestamp: maintenant.toISOString() }
    } catch (error) {
      console.error('[CRON cleanup-expired-swaps] Erreur:', error)
      throw error
    }
  },
})
