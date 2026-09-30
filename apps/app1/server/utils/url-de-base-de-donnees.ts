/**
 * Lire les identifiants de connexion d'une `DATABASE_URL`.
 *
 * ⚠️ CE QUI N'ALLAIT PAS. `prisma.ts` passait `url.username`, `url.password` et `url.pathname`
 * directement au pilote MariaDB. Or `new URL()` rend ces champs POURCENT-ENCODÉS : un mot de passe
 * écrit `p%40ss` dans l'URL — la seule écriture valable pour `p@ss` — arrivait au pilote sous la
 * forme `p%40ss`, et l'authentification échouait.
 *
 * Le symptôme est particulièrement trompeur : « Access denied for user », le message qu'on lit
 * quand le mot de passe est FAUX. On cherche alors une erreur de saisie, et on ne trouve rien —
 * puisque le mot de passe est juste, c'est son transport qui le corrompt.
 *
 * ⚠️ L'AUTRE MOITIÉ DU PROBLÈME, qui n'est pas ici : encore faut-il que l'URL soit correctement
 * FORMÉE. `docker-compose.prod.yml` interpolait `${MYSQL_PASSWORD}` brut dans la chaîne ; un mot de
 * passe contenant `@`, `/`, `:` ou `#` produisait une URL que `new URL()` découpe de travers, bien
 * avant tout décodage. C'est l'entrypoint qui construit désormais l'URL, avec
 * `encodeURIComponent`. Les deux moitiés se répondent : l'une encode, l'autre décode.
 */

export interface IdentifiantsDeBase {
  host: string
  port: number
  user: string
  password: string
  database: string
}

/**
 * Décode un champ d'URL, en tolérant un encodage invalide.
 *
 * `decodeURIComponent` LÈVE sur un `%` isolé (`URIError: URI malformed`) — et un mot de passe
 * contenant un `%` littéral mal encodé est exactement le cas où l'on veut un message utile plutôt
 * qu'une exception au démarrage. On rend alors la valeur telle quelle : si elle est juste, la
 * connexion passe ; si elle est fausse, l'erreur d'authentification est la bonne erreur.
 */
function decoderChamp(valeur: string): string {
  try {
    return decodeURIComponent(valeur)
  } catch {
    return valeur
  }
}

/**
 * Analyse une `DATABASE_URL` et rend les identifiants DÉCODÉS, prêts pour le pilote.
 *
 * Le port retombe sur 3306 quand l'URL ne le précise pas — `new URL()` rend alors une chaîne vide,
 * et `parseInt('')` vaut `NaN`.
 */
export function analyserUrlDeBase(databaseUrl: string): IdentifiantsDeBase {
  const url = new URL(databaseUrl)

  return {
    host: url.hostname,
    port: parseInt(url.port, 10) || 3306,
    user: decoderChamp(url.username),
    password: decoderChamp(url.password),
    /*
     * Le nom de base est décodé aussi. C'est plus rare mais pas théorique : un nom contenant un
     * espace ou un tiret cadratin s'écrit encodé dans le chemin, et le pilote attend le nom réel.
     */
    database: decoderChamp(url.pathname.slice(1)),
  }
}
