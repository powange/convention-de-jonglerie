/**
 * Messages non lus d'une candidature à un appel à spectacles — contrat d'hôte du layer artistes.
 * Flowvent n'a PAS de messagerie (décision de l'utilisateur, 25/11/2026) : aucune candidature n'a
 * de conversation, donc aucun non-lu. Même signature qu'app1.
 */
export async function nonLusParCandidature(
  _candidatures: { id: number; conversation?: { id: string } | null }[],
  _userId: number
): Promise<Map<number, number>> {
  return new Map()
}
