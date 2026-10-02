/**
 * Le répertoire qui porte les fichiers de build, propre à chaque construction en production.
 *
 * ⚠️ POURQUOI IL N'EST PLUS FIGÉ À `/_nuxt/`. Le 2 octobre 2026, la production a servi sous
 * `/_nuxt/KNI9fb3m.js` **deux contenus différents** : celui de l'origine, et celui que le CDN avait
 * gardé d'un build précédent. Mesuré : 93 empreintes SRI justes sur 94, et les deux fichiers ne
 * différaient que par UN nom de dépendance (`BYk0WuDd.js` contre `1rtbAz9v.js`).
 *
 * La cause est en amont de nous : Rollup fige l'empreinte qui NOMME un chunk avant d'y réécrire
 * les noms de ses dépendances (`__vite__mapDeps`). Une dépendance qui change de hash modifie donc
 * le contenu du parent **sans changer son nom**. Comme ces fichiers sont servis en
 * `immutable, max-age=1 an` (`server/middleware/cache-headers.ts`), le CDN garde la première
 * version qu'il a vue, pour un an.
 *
 * Pour le visiteur : au rechargement, le `<link rel="modulepreload" integrity="…">` rejette le
 * fichier du cache et la page entière tombe en erreur ; en navigation par lien elle passe, car
 * l'`import()` ne porte pas d'empreinte. D'où un défaut qui ne frappait QUE l'accueil, et
 * seulement au rechargement.
 *
 * Un répertoire par build rend la collision impossible : deux constructions ne partagent plus
 * aucune URL. Le coût est réel et assumé — chaque déploiement repart avec un cache CDN froid.
 */

/** Longueur retenue de l'empreinte : assez pour être unique, assez court pour rester lisible. */
const LONGUEUR_EMPREINTE = 12

/**
 * Le répertoire des fichiers de build pour une empreinte donnée.
 *
 * Sans empreinte — développement, construction locale, essai manuel —, on garde `/_nuxt/` : le
 * rechargement à chaud et l'outillage s'y réfèrent, et aucun CDN ne s'interpose.
 *
 * ⚠️ Le filtrage des caractères n'est pas décoratif : cette valeur devient un CHEMIN d'URL. Une
 * empreinte fantaisiste produirait un répertoire que ni `cache-headers.ts` ni le service worker ne
 * reconnaîtraient — les deux attendent `_nuxt` suivi d'un tiret et de caractères alphanumériques.
 */
export function repertoireDeBuild(empreinte: string | undefined | null): string {
  const propre = (empreinte ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, LONGUEUR_EMPREINTE)
  return propre ? `/_nuxt-${propre}/` : '/_nuxt/'
}

/** Reconnaît `/_nuxt/` comme `/_nuxt-<empreinte>/`, pour les deux lecteurs de chemins. */
export const MOTIF_REPERTOIRE_DE_BUILD = /^\/_nuxt(-[A-Za-z0-9]+)?\//
