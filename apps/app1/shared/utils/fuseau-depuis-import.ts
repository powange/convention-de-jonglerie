import { DateTime } from 'luxon'

/**
 * Le fuseau d'un import, ramené à un fuseau IANA de LOCALITÉ — ou refusé.
 *
 * ## Le problème que cette fonction résout
 *
 * L'IA d'import renvoie parfois une ABRÉVIATION (« EDT ») là où le prompt demande un fuseau IANA
 * (« America/New_York »). Le prompt l'exige déjà, exemples compris : il a glissé quand même, et
 * durcir le texte ne tiendra pas davantage.
 *
 * ⚠️ MAIS LE DÉFAUT N'EST PAS CELUI QU'ON CROIT. La garde d'import s'appuyait sur Luxon, qui
 * **refuse** `EDT` et **accepte** `EST`, `MST`, `BST`, `IST`, `CST`, `PST`, `CET`, `GMT`. Elle
 * refusait donc le cas SÛR et laissait passer les cas FAUX. Mesuré au 07/10/2026, sur une date
 * d'été :
 *
 * | valeur | ce que Luxon en fait | écart réel |
 * |--------|----------------------|------------|
 * | `EST`  | −5 FIXE, sans heure d'été | 1 h de trop en été à New York |
 * | `MST`  | −7 fixe | 1 h de trop en été à Denver |
 * | `BST`  | **+6 — le Bangladesh**, pas British Summer Time | 6 h pour le Royaume-Uni |
 * | `IST`  | +5:30, l'Inde | 4 h 30 pour l'Irlande |
 * | `CST`  | Chicago | 13 h pour la Chine |
 *
 * Un décalage d'une heure sur une date d'édition déplace la frontière des journées, donc le
 * découpage du programme et des créneaux — c'est exactement ce que l'import dit refuser.
 *
 * ## La règle, et pourquoi elle tient
 *
 * **Une abréviation d'heure D'ÉTÉ désigne sans ambiguïté une famille de fuseaux qui observe l'heure
 * d'été** : « EDT » ne peut être que l'Est nord-américain. On la traduit donc en son fuseau de
 * localité, qui porte les règles de bascule.
 *
 * **Une abréviation d'heure STANDARD est ambiguë deux fois** : dans l'espace — `CST` vaut pour les
 * États-Unis, la Chine et Cuba, `IST` pour l'Inde, l'Irlande et Israël — et dans le TEMPS, puisque
 * `MST` désigne le Colorado en hiver et l'Arizona toute l'année. On la refuse.
 *
 * **Tout ce qui n'est pas `Région/Localité` est refusé**, `UTC` excepté. Les alias historiques sans
 * barre oblique (`Japan`, `Iceland`, `EST5EDT`) sont écartés avec : ils sont dépréciés, aucune
 * édition n'en emploie, et la liste blanche serait sans fin. Les 31 éditions en base utilisent
 * toutes la forme `Région/Localité`, donc ce resserrement ne refuse rien d'existant.
 */

/**
 * Les abréviations d'heure d'été, et le fuseau de localité qui porte leurs règles.
 *
 * Le fuseau choisi est le plus peuplé de sa famille : les autres membres (`America/Toronto` pour
 * `EDT`, `America/Vancouver` pour `PDT`) ont les mêmes règles de bascule, donc le même instant pour
 * une même heure murale. Le but est d'ancrer une date, pas de nommer une ville.
 */
const HEURE_DETE_VERS_IANA: Record<string, string> = {
  EDT: 'America/New_York',
  CDT: 'America/Chicago',
  MDT: 'America/Denver',
  PDT: 'America/Los_Angeles',
  ADT: 'America/Halifax',
  AKDT: 'America/Anchorage',
  CEST: 'Europe/Paris',
  EEST: 'Europe/Athens',
  WEST: 'Europe/Lisbon',
  AEDT: 'Australia/Sydney',
  ACDT: 'Australia/Adelaide',
  AWDT: 'Australia/Perth',
  NZDT: 'Pacific/Auckland',
}

/** Un fuseau IANA de localité : `Région/Localité`. `UTC` est le seul sans barre accepté. */
const EST_UN_FUSEAU_DE_LOCALITE = (valeur: string) => valeur === 'UTC' || valeur.includes('/')

export type FuseauDImport =
  | { ok: true; fuseau: string | null; corrige: boolean }
  | { ok: false; raison: 'abreviation_ambigue' | 'forme_invalide' | 'inconnu'; suggestion?: string }

/**
 * @param valeur ce que l'import annonce. `null`/vide est LÉGITIME — le champ est facultatif, et
 *   douze éditions sur quarante-trois n'en déclarent pas ; l'ancrage retombe alors sur UTC.
 */
export function fuseauDImport(valeur?: string | null): FuseauDImport {
  const brut = valeur?.trim()
  if (!brut) return { ok: true, fuseau: null, corrige: false }

  // Une abréviation d'heure d'été se traduit : c'est le cas que l'IA produit, et il est sûr.
  const traduit = HEURE_DETE_VERS_IANA[brut.toUpperCase()]
  if (traduit) return { ok: true, fuseau: traduit, corrige: true }

  /*
   * Tout ce qui n'a pas la forme `Région/Localité` est refusé — y compris ce que Luxon accepterait.
   * C'est le cœur du correctif : `EST`, `BST` ou `IST` passaient la garde et décalaient les dates
   * de 1 à 13 heures, en silence.
   */
  if (!EST_UN_FUSEAU_DE_LOCALITE(brut)) {
    const majuscules = /^[A-Z]{2,5}$/.test(brut)
    return majuscules
      ? { ok: false, raison: 'abreviation_ambigue' }
      : { ok: false, raison: 'forme_invalide' }
  }

  // La forme est bonne : reste à savoir si le fuseau existe.
  if (!DateTime.local().setZone(brut).isValid) return { ok: false, raison: 'inconnu' }

  return { ok: true, fuseau: brut, corrige: false }
}

/** Le message à montrer quand le fuseau est refusé : il doit dire quoi écrire. */
export function messageDeRefusDuFuseau(resultat: Extract<FuseauDImport, { ok: false }>): string {
  if (resultat.raison === 'abreviation_ambigue') {
    return (
      'Fuseau horaire ambigu : une abréviation d’heure standard peut désigner plusieurs régions ' +
      '(« IST » vaut pour l’Inde, l’Irlande et Israël) ou un décalage figé sans heure d’été. ' +
      'Attendu : un fuseau IANA de la forme Région/Localité, par exemple America/New_York ou Europe/Paris.'
    )
  }
  if (resultat.raison === 'forme_invalide') {
    return 'Fuseau horaire mal formé. Attendu : Région/Localité, par exemple Europe/Paris.'
  }
  return 'Fuseau horaire inconnu. Attendu : un fuseau IANA de la forme Région/Localité, par exemple Europe/Paris.'
}
