import { ERREUR_EXPIRATION } from './fetch-helpers'

/**
 * Appeler un modèle local en imposant un schéma JSON, et SE REPLIER s'il le refuse.
 *
 * ⚠️ LE REPLI N'EST PAS DE LA PRUDENCE DÉCORATIVE. La documentation de LM Studio montre la forme de
 * `response_format` sans préciser la sémantique de `strict` ni le sort des champs facultatifs, et
 * le serveur est celui de l'utilisateur, sur sa machine : impossible de l'éprouver depuis ici. Un
 * serveur plus ancien, ou un modèle sans grammaire, refuserait la requête ENTIÈRE — et l'extraction
 * cesserait de fonctionner pour un gain qu'elle n'aurait même pas obtenu.
 *
 * Le second essai est donc exactement la requête d'avant ce dispositif : au pire on retrouve
 * l'ancien comportement, et le journal dit pourquoi.
 *
 * 📍 L'APPELANT EST INJECTÉ, et ce n'est pas de la cérémonie : cette fonction vivait dans le point
 * d'API, où elle n'était pas testable — le module de bascule y est résolu par l'auto-import de
 * Nitro, qu'un `vi.mock` ne remplace pas. Reçue en paramètre, la dépendance se bouchonne sans
 * toucher au harnais.
 *
 * @param appeler ce qui exécute vraiment la requête, en général `fetchLocalModelAvecSecours`.
 * @param corps la fabrique de corps : reçoit le format à imposer, ou `null` au second essai.
 */
export async function appelerAvecSchemaJsonOuSansLui<TServeur, TFormat, TReponse>(
  appeler: (fabrique: (serveur: TServeur) => RequestInit) => Promise<TReponse>,
  corps: (serveur: TServeur, format: TFormat | null) => RequestInit,
  format: TFormat,
  journaliser: (message: string) => void = (m) => console.warn(m)
): Promise<TReponse> {
  try {
    return await appeler((serveur) => corps(serveur, format))
  } catch (error: any) {
    /*
     * Une EXPIRATION n'est pas un refus du schéma : le serveur a bien répondu, trop lentement.
     * Réessayer doublerait l'attente pour le même verdict — c'est la règle que la bascule de
     * serveur s'est déjà donnée, et on l'étend ici.
     */
    if (error?.[ERREUR_EXPIRATION] === true) throw error

    journaliser(
      `[GENERATE-IMPORT] Le modèle a refusé le schéma JSON (${error?.message}) — nouvel essai sans contrainte`
    )
    return await appeler((serveur) => corps(serveur, null))
  }
}
