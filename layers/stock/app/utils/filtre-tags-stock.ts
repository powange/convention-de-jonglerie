/**
 * Le filtrage du stock par tags.
 *
 * Les tags traversent les groupes : ils servent à retrouver « tout ce qui est fragile » sans
 * savoir où c'est rangé. Le filtre est donc au cœur de leur utilité, pas un ornement.
 */

/** Un objet, réduit aux tags qu'il porte. */
export interface ObjetTague {
  tags?: Array<{ tag: { id: number } }> | null
}

/**
 * Les objets qui portent AU MOINS UN des tags choisis.
 *
 * L'union et non le cumul : les tags décrivent des qualités indépendantes — fragile, lourd,
 * prêté —, et en exiger deux à la fois ne donnait presque jamais de résultat, au point que
 * l'écran paraissait cassé. Cocher plusieurs tags élargit donc la liste au lieu de la vider.
 *
 * Sans tag choisi, rien n'est filtré — la liste entière, et non une liste vide.
 */
export function filtrerParTags<T extends ObjetTague>(objets: T[], tagsChoisis: number[]): T[] {
  if (tagsChoisis.length === 0) return objets

  return objets.filter((objet) => {
    const portes = new Set((objet.tags ?? []).map((rattachement) => rattachement.tag.id))
    return tagsChoisis.some((tagId) => portes.has(tagId))
  })
}

/**
 * Les identifiants de tags portés par l'URL.
 *
 * Le filtre vit dans l'adresse pour qu'un lien puisse être partagé et qu'un rechargement ne le
 * perde pas — « tiens, regarde tout ce qui est fragile » doit tenir en un lien.
 *
 * Tolère ce qu'une adresse peut contenir : valeurs absentes, doublons, entrées vides ou non
 * numériques. Une URL trafiquée ne doit pas casser l'écran, seulement filtrer moins bien.
 */
export function tagsDepuisUrl(valeur: unknown): number[] {
  const brut = Array.isArray(valeur) ? valeur.join(',') : typeof valeur === 'string' ? valeur : ''

  const identifiants = brut
    .split(',')
    .map((morceau) => Number.parseInt(morceau.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0)

  return Array.from(new Set(identifiants))
}

/**
 * La valeur à écrire dans l'URL, ou `undefined` pour retirer le paramètre.
 *
 * Un `?tags=` vide traînerait dans l'adresse après avoir tout décoché, et se partagerait tel quel.
 */
export function urlDepuisTags(tagIds: number[]): string | undefined {
  return tagIds.length > 0 ? tagIds.join(',') : undefined
}
