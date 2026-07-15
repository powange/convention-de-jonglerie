/**
 * Adresses en copie cachée de tous les envois réels (SMTP_BCC), pour archivage.
 *
 * Les adresses mal formées ou sur un domaine de test sont écartées ici plutôt qu'envoyées au
 * serveur SMTP : celui-ci les rejetterait au RCPT TO sans faire échouer l'envoi (nodemailer ne
 * lève que si TOUS les destinataires sont rejetés), donc l'archivage échouerait en silence.
 * Mieux vaut un log explicite au premier envoi qu'une archive vide découverte trop tard.
 *
 * Les doublons sont éliminés (comparaison insensible à la casse) : ils consommeraient un
 * destinataire de plus à chaque envoi, ce qui compte sur les transports à quota par destinataire.
 *
 * @param configuredBcc - Contenu brut de SMTP_BCC (une ou plusieurs adresses séparées par des virgules)
 * @param blockedDomains - Domaines pour lesquels aucun envoi ne doit être tenté
 * @returns Les adresses retenues, dédoublonnées, dans l'ordre de configuration
 */
export function getBccRecipients(
  configuredBcc: string,
  blockedDomains: readonly string[] = []
): string[] {
  const candidates = configuredBcc
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean)

  const isWellFormed = (address: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)
  const isBlocked = (address: string) =>
    blockedDomains.includes(address.split('@')[1]?.toLowerCase() ?? '')

  const rejected = candidates.filter((address) => !isWellFormed(address) || isBlocked(address))
  if (rejected.length > 0) {
    console.error(
      `❌ SMTP_BCC ignoré (adresse invalide ou domaine interdit) : ${rejected.join(', ')}`
    )
  }

  const seen = new Set<string>()
  return candidates
    .filter((address) => isWellFormed(address) && !isBlocked(address))
    .filter((address) => {
      const key = address.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}
