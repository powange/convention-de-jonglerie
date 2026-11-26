/**
 * Messagerie — contrat d'hôte des layers partagés. Flowvent n'a PAS de messagerie (décision de
 * l'utilisateur, 25/11/2026 : l'appel à spectacles se porte sans elle) : les conversations de
 * groupe d'un spectacle n'existent pas, et leur synchronisation n'a rien à faire.
 */
export async function syncShowGroupParticipants(_showId: number, _tx?: unknown): Promise<void> {}
