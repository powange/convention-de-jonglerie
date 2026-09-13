/**
 * L'empreinte d'une erreur : ce qui fait que deux entrées du journal décrivent le MÊME problème.
 *
 * Quatre composantes — type, méthode, chemin, message — et il en faut quatre. La résolution en
 * masse n'en employait qu'une, le message, et son `where` était `{ message, resolved: false }`.
 * Marquer résolu un « Données invalides » sur une route les résolvait donc sur TOUTES les autres :
 * un message générique est partagé par des dizaines d'endpoints, et l'écran ne montrait rien de
 * cette portée.
 *
 * La notion existait pourtant déjà, écrite trois fois et jamais nommée : dans
 * `.claude/error-logs-monitor.json` sous sa forme complète, dans l'anti-spam des alertes sous une
 * forme à trois composantes, et en creux dans la résolution en masse qui n'en gardait qu'une. D'où
 * ce fichier : une seule définition, et les écarts assumés plutôt que subis.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Ce qu'il faut d'un log pour en calculer l'empreinte. Tout est facultatif : la base l'admet. */
export interface LogIdentifiable {
  errorType?: string | null
  method?: string | null
  path?: string | null
  message?: string | null
}

/**
 * Les quatre composantes, normalisées.
 *
 * `errorType` garde son `null` plutôt que de retomber sur une chaîne : la colonne est nullable, et
 * un filtre Prisma doit pouvoir distinguer « pas de type » d'un type nommé « null ».
 */
export interface ComposantesDEmpreinte {
  errorType: string | null
  method: string
  path: string
  message: string
}

/** Le séparateur de la forme textuelle, identique à celui de `.claude/error-logs-monitor.json`. */
export const SEPARATEUR_EMPREINTE = '|'

/** Ce qu'on écrit à la place d'un type absent, dans la forme TEXTUELLE uniquement. */
export const TYPE_ABSENT = 'UnknownError'

/** Les composantes d'un log, prêtes à servir de filtre. */
export function composantesDEmpreinte(log: LogIdentifiable): ComposantesDEmpreinte {
  return {
    errorType: log.errorType ?? null,
    method: log.method ?? '',
    path: log.path ?? '',
    message: log.message ?? '',
  }
}

/**
 * L'empreinte sous forme lisible, pour comparer, afficher ou journaliser.
 *
 * Même forme que les empreintes écartées de `.claude/error-logs-monitor.json`, pour qu'on puisse
 * confronter les deux sans traduction : `errorType|method|path|message`.
 */
export function empreinteDErreur(log: LogIdentifiable): string {
  const { errorType, method, path, message } = composantesDEmpreinte(log)

  return [errorType ?? TYPE_ABSENT, method, path, message].join(SEPARATEUR_EMPREINTE)
}

/**
 * La signature des alertes push, délibérément PLUS GROSSIÈRE : sans le message.
 *
 * Elle sert l'anti-spam, pas l'identification. Une panne qui produit vingt messages différents sur
 * le même endpoint est une seule panne pour qui reçoit les notifications, et vingt alertes ne lui
 * apprendraient rien de plus.
 *
 * Elle est ici, à côté de l'autre, pour que la différence soit un choix qu'on lit plutôt qu'un
 * écart qu'on découvre — c'est précisément parce que ces deux notions vivaient séparément que la
 * résolution en masse a pu n'en garder qu'une composante sans que personne ne le remarque.
 */
export function signatureDAlerte(log: LogIdentifiable): string {
  const { errorType, method, path } = composantesDEmpreinte(log)

  return [errorType ?? TYPE_ABSENT, method, path].join(SEPARATEUR_EMPREINTE)
}

/** Deux entrées décrivent-elles le même problème&nbsp;? */
export function memeEmpreinte(un: LogIdentifiable, autre: LogIdentifiable): boolean {
  return empreinteDErreur(un) === empreinteDErreur(autre)
}
