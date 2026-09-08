/**
 * La FAQ, préparée pour le document imprimable.
 *
 * Deux usages coexistent : la FAQ telle que le public la voit, qu'on laisse à l'accueil, et le
 * document de travail interne où figurent aussi les réponses privées. La distinction se fait ici,
 * pas au moment du rendu — le tri de ce qui sort du site est trop conséquent pour être noyé dans
 * du code de mise en page.
 */

/** Une entrée, sa réponse déjà réduite en texte brut. */
export interface EntreeFaqSource {
  question: string
  /** La réponse en texte, le balisage du markdown déjà retiré. */
  reponseTexte: string
  isPublic: boolean
}

/** Une entrée telle que le document la porte. */
export interface EntreeFaqPdf {
  question: string
  reponse: string
  /** Vrai pour une entrée qui n'est pas publiée : le document doit le signaler. */
  prive: boolean
}

/** Resserre un texte : bords nettoyés, et jamais plus d'une ligne vide d'affilée. */
function resserrer(texte: string): string {
  return texte
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((ligne) => ligne.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Les entrées à imprimer, dans l'ordre reçu.
 *
 * Sans `inclurePrivees`, les entrées non publiées disparaissent purement : une impression laissée
 * sur une table ne doit pas exposer des consignes internes. Avec, elles restent et sont marquées,
 * pour qu'on sache d'un coup d'œil ce qui n'est pas destiné au public.
 *
 * Une entrée sans question est écartée : elle n'aurait rien à porter dans un sommaire, et le
 * document en garderait un trou.
 */
export function preparerFaqPourPdf(
  entrees: EntreeFaqSource[],
  options: { inclurePrivees: boolean }
): EntreeFaqPdf[] {
  return entrees
    .filter((entree) => options.inclurePrivees || entree.isPublic)
    .map((entree) => ({
      question: resserrer(entree.question),
      reponse: resserrer(entree.reponseTexte),
      prive: !entree.isPublic,
    }))
    .filter((entree) => entree.question.length > 0)
}

/**
 * Le nom du fichier proposé au téléchargement.
 *
 * Le nom de l'édition y entre tel quel, réduit aux caractères qu'un système de fichiers accepte
 * partout : accents retirés, ponctuation remplacée par un tiret. Sans nom d'édition, un libellé
 * générique plutôt qu'un fichier appelé `-.pdf`.
 */
export function nomFichierFaq(nomEdition: string | null | undefined, prefixe = 'faq'): string {
  const base = (nomEdition ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return base ? `${prefixe}-${base}.pdf` : `${prefixe}.pdf`
}
