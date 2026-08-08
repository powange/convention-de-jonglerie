/**
 * Mesure la part d'un texte extrait qui se retrouve réellement dans sa source.
 *
 * Le programme d'une journée doit être un relevé, pas une rédaction : la consigne demande au
 * modèle de recopier la page. Mais une consigne ne se vérifie pas d'elle-même — un modèle qui
 * invente des horaires plausibles produit un texte indiscernable d'un bon relevé, tant qu'on ne
 * le confronte pas à la source.
 *
 * D'où cette mesure. Elle ne juge pas la qualité du contenu, seulement sa provenance.
 */

/** Minuscules, espaces normalisés : les seules libertés qu'on accorde au copiste. */
function normaliser(texte: string): string {
  return texte.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Proportion des lignes de l'extrait retrouvées dans la source, entre 0 et 1.
 *
 * Les lignes très courtes — une heure isolée, un tiret — sont ignorées : elles se retrouvent
 * partout et gonfleraient artificiellement le score sans rien prouver.
 *
 * Rend 1 pour un extrait vide : il n'y a rien d'inventé dans rien.
 */
export function mesurerFidelite(extrait: string, source: string): number {
  const sourceNormalisee = normaliser(source)
  if (!sourceNormalisee) return 0

  const lignes = extrait
    .split('\n')
    .map(normaliser)
    .filter((ligne) => ligne.length >= 12)

  if (lignes.length === 0) return 1

  const retrouvees = lignes.filter((ligne) => sourceNormalisee.includes(ligne)).length
  return retrouvees / lignes.length
}
