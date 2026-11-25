/**
 * À quelle journée appartient un instant, du point de vue de l'édition.
 *
 * Les créneaux sont stockés en UTC. En tirer le jour avec `toISOString().split('T')[0]` — ce que
 * faisaient les trois relevés de statistiques — range la nuit du mauvais côté : en France l'été
 * (UTC+2), un créneau commençant à 00h30 le samedi vaut 22h30 le vendredi en UTC, et ses heures
 * étaient comptées le vendredi alors que le planning l'affichait le samedi. Une heure de décalage
 * en hiver, deux en été, soit une plage nocturne entière mal rattachée — précisément celle où les
 * conventions placent leurs permanences de nuit.
 *
 * La journée retenue est donc celle **vécue sur place**, dans le fuseau de l'édition. C'est aussi
 * celui qu'on impose au calendrier, pour que les deux affichages ne puissent plus se contredire.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/**
 * La journée d'un instant, au format `AAAA-MM-JJ`.
 *
 * @param instant  une date, ou une chaîne que `Date` sait lire
 * @param fuseau   identifiant IANA de l'édition (`Europe/Paris`…). Vide ou inconnu : on retombe
 *                 sur le fuseau de la machine qui regarde, lequel est aussi celui du calendrier
 *                 par défaut. Le repli garde donc les deux affichages d'accord, ce qui est tout
 *                 l'objet de cette fonction — plutôt que l'UTC, qui était le défaut d'origine.
 */
export function jourDeLEdition(instant: Date | string, fuseau?: string | null): string {
  const date = instant instanceof Date ? instant : new Date(instant)
  if (!Number.isFinite(date.getTime())) return ''

  return formater(date, fuseau || undefined)
}

/**
 * `en-CA` rend `AAAA-MM-JJ`, le seul format de date que l'on veuille ici.
 *
 * Un fuseau inconnu fait lever `Intl` : plutôt que de laisser l'exception remonter et vider tout
 * un relevé de statistiques pour une chaîne mal saisie, on repart sans fuseau — donc sur celui de
 * la machine, comme lorsqu'il n'est pas renseigné.
 */
function formater(date: Date, fuseau?: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: fuseau,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  }
}
