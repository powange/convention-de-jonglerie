/**
 * Combien de CARACTÈRES de page on peut envoyer à un modèle local.
 *
 * ## Les deux erreurs que ce calcul corrige
 *
 * L'ancienne version réservait 1500 jetons « pour le prompt système ET la réponse », puis donnait
 * 60 % du reste au contenu, à raison de **4 caractères par jeton**. Les deux chiffres étaient faux,
 * et ils se composaient. Constaté sur un import réel, contexte chargé à 8192 jetons :
 *
 *     request (8437 tokens) exceeds the available context size (8192 tokens)
 *
 * **1. `max_tokens` n'était pas déduit.** La réponse est budgétée à 4096 jetons — plus du double de
 * ce que le calcul réservait pour la réponse ET le prompt système réunis. Sur un contexte de 8192,
 * il ne reste donc que 4096 jetons pour toute la requête, pas 6692.
 *
 * **2. « 4 caractères par jeton » est une hypothèse de texte courant.** Sur du contenu scrapé —
 * balisage, URL, accents, ponctuation — le rapport mesuré est d'environ **1,5** : les ~12 800
 * caractères envoyés pesaient 8437 jetons. Le budget accordait donc près de trois fois la place
 * disponible.
 *
 * Résultat : 16 060 caractères accordés là où ~6 100 tenaient, et le serveur refusait la requête
 * ENTIÈRE — « LM Studio error: Bad Request », sans rien dire de la cause côté application.
 *
 * ## Ce qui est retenu, et pourquoi
 *
 * On soustrait d'abord ce qui est dû : la réponse (`max_tokens`) et le prompt système. Ce qui reste
 * est converti en caractères avec un rapport PRUDENT, puis amputé d'une marge — le rapport reste
 * une estimation, et dépasser coûte la requête entière quand sous-estimer ne coûte qu'un peu de
 * contenu.
 */

/**
 * Caractères par jeton, volontairement PESSIMISTE.
 *
 * Mesuré à ~1,5 sur du contenu de convention scrapé. On retient 2 : au-dessus de la mesure pour ne
 * pas gaspiller la moitié du contexte sur du texte plus ordinaire, en dessous des 4 qui ont causé
 * le débordement. Se tromper vers le bas tronque un peu ; vers le haut, tout est refusé.
 */
export const CARACTERES_PAR_JETON = 2

/**
 * Ce que coûte le prompt système, en jetons.
 *
 * Les prompts d'extraction font quelques centaines de jetons et varient selon le mode. Mesuré
 * grossièrement plutôt que calculé : le tokeniser du modèle n'est pas accessible d'ici, et une
 * réserve un peu large ne coûte que du contenu.
 */
export const RESERVE_PROMPT_SYSTEME = 800

/** La part du budget restant qu'on s'autorise, le rapport caractères/jeton étant une estimation. */
const MARGE = 0.85

/** En dessous, il n'y a plus de quoi extraire quoi que ce soit : autant envoyer ce minimum. */
const PLANCHER = 1500

/**
 * Le plafond absolu, indépendant du contexte.
 *
 * Il borne la requête pour un modèle à très grand contexte : au-delà, on paie du temps de
 * traitement pour du contenu qui n'apporte plus rien à une extraction de quelques champs.
 */
const PLAFOND = 50000

export function budgetDeContenu(
  contexteEnJetons: number,
  maxTokensReponse: number
): { caracteres: number; jetonsDisponibles: number } {
  const disponibles = contexteEnJetons - maxTokensReponse - RESERVE_PROMPT_SYSTEME
  const utilisables = Math.floor(Math.max(0, disponibles) * MARGE)
  const caracteres = Math.max(PLANCHER, Math.min(utilisables * CARACTERES_PAR_JETON, PLAFOND))
  return { caracteres, jetonsDisponibles: utilisables }
}
