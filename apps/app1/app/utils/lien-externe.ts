/**
 * Ce qu'on peut ouvrir, et sous quel nom on le montre.
 *
 * La règle vivait dans `edition/Form.vue`, sous le nom `isHttpUrl`, pour son seul usage de
 * validation. Le bouton « ouvrir dans un nouvel onglet » de la page des liens externes en a
 * besoin à son tour : mieux vaut une définition partagée que deux qui divergeront sur un
 * protocole ou un espace.
 */

/**
 * Cette valeur est-elle une adresse http(s) qu'on peut suivre ?
 *
 * Les seuls protocoles acceptés sont `http` et `https`. `new URL()` avale bien d'autres choses —
 * `javascript:`, `data:`, `file:` — et un bouton qui ouvre un lien saisi par un tiers n'a aucune
 * raison de les suivre. Un champ de billetterie n'est pas censé porter du script, mais c'est
 * précisément le genre de chose qu'on ne veut pas découvrir après coup.
 *
 * Les espaces autour sont ignorés : le champ les rogne à la sortie, pas pendant la frappe, et le
 * bouton doit s'activer dès que l'adresse est bonne.
 */
export function estUnLienHttp(valeur: string | null | undefined): boolean {
  const texte = (valeur ?? '').trim()
  if (texte === '') return false

  try {
    const url = new URL(texte)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
