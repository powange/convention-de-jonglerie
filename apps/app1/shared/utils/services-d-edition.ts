/**
 * La liste des services d'une édition — **une seule fois**.
 *
 * ## ⚠️ POURQUOI CE FICHIER EXISTE : QUATRE LISTES QUI ONT DÉRIVÉ
 *
 * La même énumération était écrite à quatre endroits, et trois d'entre eux ne s'accordaient plus
 * (mesuré le 09/10/2026) :
 *
 * | Où | Combien | Ce qui manquait |
 * | --- | --- | --- |
 * | `Edition` dans `prisma/schema/schema.prisma` | 26 | — (la référence) |
 * | `ConventionServiceKeys` (`app/utils/convention-services.ts`) | 26 | — |
 * | `editionSchema` (`server/utils/validation-schemas.ts`) | 26 | — |
 * | l'état de `app/components/edition/Form.vue` | **23** | `hasUnicycleSpace`, `hasLongShow`, `hasATM` |
 * | la destructuration de `server/api/editions/index.post.ts` | **23** | les trois mêmes |
 *
 * Conséquence observable : ces trois services étaient **proposés comme filtres** sur l'accueil et
 * **modifiables depuis la page Services de la gestion**, mais le formulaire de création/édition ne
 * les montrait pas — et, même envoyés à la main, le serveur les perdait, puisqu'il écrivait
 * seulement ce qu'il destructurait.
 *
 * ## Ce que ce fichier ne résout PAS tout seul
 *
 * Une liste partagée n'empêche pas d'oublier une colonne nouvelle : elle déplace l'oubli d'un
 * endroit à cinq vers un endroit à un. C'est `test/unit/utils/services-d-edition.test.ts` qui
 * ferme la boucle, en comparant cette liste aux colonnes booléennes réellement déclarées dans
 * `schema.prisma`. Ajouter une colonne sans l'ajouter ici fait donc tomber un test, et non
 * disparaître un service en silence.
 *
 * 📍 Le fichier vit dans `shared/` parce que les deux côtés en ont besoin : `app/` pour l'état du
 * formulaire et les filtres, `server/` pour le schéma de validation et l'écriture.
 */

/**
 * Les clés des services, dans l'ordre où `schema.prisma` déclare ses colonnes.
 *
 * L'ordre n'a **aucun effet fonctionnel** : l'affichage est gouverné par `conventionServices`, qui
 * porte catégories et icônes. Il suit celui du schéma pour qu'une relecture côte à côte se fasse
 * sans tri mental — et cet ordre-là n'est pas alphabétique, il porte la trace des migrations
 * successives (`hasPrmAccess` entre `hasTruckCamping` et `hasAerialSpace`, `hasATM` avant
 * `hasLongShow`). Ne pas le « ranger » : le test de comparaison trie, mais une relecture humaine
 * non.
 */
export const CLES_SERVICES_EDITION = [
  'acceptsPets',
  'hasFoodTrucks',
  'hasGym',
  'hasKidsZone',
  'hasTentCamping',
  'hasTruckCamping',
  'hasPrmAccess',
  'hasSignLanguage',
  'hasAerialSpace',
  'hasCantine',
  'hasConcert',
  'hasFamilyCamping',
  'hasSleepingRoom',
  'hasFireSpace',
  'hasGala',
  'hasOpenStage',
  'hasShowers',
  'hasSlacklineSpace',
  'hasUnicycleSpace',
  'hasToilets',
  'hasWorkshops',
  'hasCashPayment',
  'hasCreditCardPayment',
  'hasAfjTokenPayment',
  'hasATM',
  'hasLongShow',
] as const

export type CleServiceEdition = (typeof CLES_SERVICES_EDITION)[number]

/** Les services d'une édition, tous booléens. Remplace les énumérations recopiées à la main. */
export type ServicesEdition = Record<CleServiceEdition, boolean>

/**
 * L'état initial des services pour un formulaire : tout à `false`, puis ce que porte l'édition.
 *
 * ⚠️ Le repli est `false` et non `?? false` : `props.initialData?.hasGym` vaut `undefined` sur une
 * création, et une case à cocher liée à `undefined` n'est ni cochée ni décochée — Vue la traite
 * comme non contrôlée et `UCheckbox` n'émet alors rien au premier clic.
 */
export function servicesDepuisEdition(source?: Partial<ServicesEdition> | null): ServicesEdition {
  return Object.fromEntries(
    CLES_SERVICES_EDITION.map((cle) => [cle, source?.[cle] === true])
  ) as ServicesEdition
}

/**
 * Les services à écrire en base, depuis des données déjà validées.
 *
 * Un service absent du corps vaut `false` : une édition se crée avec des services explicitement
 * éteints, jamais avec des colonnes `undefined` que Prisma laisserait au défaut du schéma — ce qui
 * reviendrait au même ici, mais cesserait de l'être au premier défaut non nul.
 */
export function servicesPourEcriture(source: Partial<ServicesEdition>): ServicesEdition {
  return servicesDepuisEdition(source)
}
