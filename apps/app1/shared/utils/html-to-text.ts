/**
 * Conversion d'une page HTML en texte, à plat.
 *
 * L'extracteur habituel produit un résumé structuré, calibré pour tenir dans un prompt : sur une
 * page de programme de 63 000 caractères, il n'en rendait que 5 164, et les dernières journées de
 * la convention disparaissaient. C'est le bon comportement pour décrire un événement, le mauvais
 * pour relever un déroulé heure par heure.
 *
 * Ici on ne résume rien. On retire le balisage et on garde les sauts de ligne, parce que c'est
 * l'ordre et la séparation des lignes qui portent le programme.
 */

/** Entités les plus courantes dans une page de convention. */
const ENTITES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&eacute;': 'é',
  '&egrave;': 'è',
  '&agrave;': 'à',
  '&ccedil;': 'ç',
  '&ndash;': '–',
  '&mdash;': '—',
}

export function htmlVersTexte(html: string): string {
  let texte = html

  // Script et style portent du code, jamais du contenu lisible.
  texte = texte.replace(/<(script|style|noscript|svg)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  texte = texte.replace(/<!--[\s\S]*?-->/g, ' ')

  // Les éléments de bloc valent un saut de ligne : sans eux, le programme devient un pavé continu
  // où plus rien ne sépare une journée de la suivante.
  texte = texte.replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/td|\/th)[^>]*>/gi, '\n')
  texte = texte.replace(/<[^>]+>/g, ' ')

  for (const [entite, caractere] of Object.entries(ENTITES)) {
    texte = texte.split(entite).join(caractere)
  }
  texte = texte.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))

  return texte
    .split('\n')
    .map((ligne) => ligne.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter((ligne) => ligne.length > 0)
    .join('\n')
}
