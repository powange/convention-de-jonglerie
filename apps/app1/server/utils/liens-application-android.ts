/**
 * La composition du fichier Digital Asset Links, isolée pour être éprouvée.
 *
 * ⚠️ POURQUOI CE N'EST PAS ÉCRIT DANS LA ROUTE. Ce fichier n'échoue jamais bruyamment : une
 * empreinte mal découpée, une clé de plus ou de moins, et Android se contente d'afficher la barre
 * d'adresse de Chrome au-dessus de l'application. Aucune erreur, aucun journal. La seule façon de
 * savoir qu'il est juste AVANT de publier sur le Play Store est de l'éprouver ici.
 */

/** L'identifiant du paquet Android, fixé une fois pour toutes. */
export const PAQUET_ANDROID = 'com.jugglingconvention.app'

/**
 * Découpe la liste d'empreintes de la variable d'environnement.
 *
 * Le format attendu est celui que la console Play affiche : des octets en hexadécimal séparés par
 * des deux-points, en majuscules. Plusieurs empreintes se séparent par une virgule — c'est le cas
 * pendant une rotation de clé, où l'ancienne et la nouvelle doivent être acceptées ensemble.
 *
 * ⚠️ LA NORMALISATION N'EST PAS DU CONFORT. Une empreinte recopiée depuis la console Play arrive
 * volontiers avec une espace en trop, un saut de ligne, ou en minuscules ; Android compare la
 * chaîne TELLE QUELLE, et refuse alors l'association sans rien dire. Mieux vaut normaliser ici que
 * de chercher la faute de frappe sur un téléphone.
 *
 * Ce qui n'a pas la forme d'une empreinte SHA-256 — 32 octets, donc 95 caractères — est écarté
 * plutôt que publié : une valeur tronquée associerait le domaine à rien du tout, et le symptôme
 * serait identique à celui d'une variable oubliée.
 */
export function empreintesDeSignature(brut: string | undefined | null): string[] {
  if (!brut) return []

  return brut
    .split(',')
    .map((empreinte) => empreinte.trim().toUpperCase())
    .filter((empreinte) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(empreinte))
}

/** Une entrée du fichier, pour une empreinte. */
export function lienVersApplication(empreinte: string) {
  return {
    /*
     * `delegate_permission/common.handle_all_urls` : c'est CETTE relation que réclame un TWA, et
     * non `common.get_login_creds`, qui sert au remplissage des mots de passe. Se tromper de
     * relation donne un fichier parfaitement valide qui n'autorise rien.
     */
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: PAQUET_ANDROID,
      sha256_cert_fingerprints: [empreinte],
    },
  }
}
