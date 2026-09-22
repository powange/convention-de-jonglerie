/**
 * Ce qu'un champ numérique de formulaire contient réellement.
 *
 * `v-model.number` n'est pas la garantie qu'on croit. Vue passe la valeur à `parseFloat` et,
 * quand le résultat est `NaN`, **rend la chaîne d'origine**. Un champ vidé donne donc `''`, pas
 * `0` ni `null` — et un schéma `z.number()` le refuse : « expected number, received string ».
 *
 * Le cas n'est pas théorique. Constaté en production le 22/09/2025 sur la création d'un tarif de
 * billetterie : un organisateur efface le champ « Position », l'enregistrement échoue en 400, et
 * rien à l'écran ne désigne le champ fautif — il n'avait touché qu'à celui-là, justement pour
 * le vider.
 *
 * ⚠️ Le dépôt compte une quinzaine de `v-model.number`. Tous ne tombent pas dans le piège — un
 * champ obligatoire ne se vide pas, un schéma tolérant s'en accommode — mais tous le peuvent.
 * Passer une valeur par ici coûte une ligne ; la diagnostiquer en production en coûte beaucoup
 * plus.
 */

/**
 * La valeur d'un champ, ramenée à un entier supérieur ou égal à zéro.
 *
 * Tolère ce qu'un champ numérique peut réellement porter : une chaîne vide, un texte collé, une
 * virgule décimale, une valeur négative. Aucun de ces cas ne mérite un échec d'enregistrement
 * sur un champ dont la valeur par défaut a un sens — un ordre d'affichage, un nombre de places.
 *
 * Le repli vaut ce que l'appelant en dit, pour coller au `default()` de son schéma : le serveur
 * et le formulaire doivent faire de l'absence la même chose, sans quoi effacer un champ et ne
 * jamais le remplir donneraient deux résultats différents.
 */
export function entierPositifDuChamp(valeur: unknown, repli = 0): number {
  // Le vide est écarté AVANT toute conversion. `Number('')` vaut zéro — un entier parfaitement
  // valide —, si bien qu'une chaîne vide franchissait la garde et rendait 0 au lieu du repli
  // demandé. Le défaut ne se voyait pas tant que le repli valait zéro, ce qui est le cas le plus
  // courant : la bonne réponse pour la mauvaise raison.
  if (valeur === null || valeur === undefined) return repli
  if (typeof valeur === 'string' && valeur.trim() === '') return repli

  const nombre = typeof valeur === 'string' ? Number(valeur.trim()) : Number(valeur)
  return Number.isInteger(nombre) && nombre >= 0 ? nombre : repli
}
