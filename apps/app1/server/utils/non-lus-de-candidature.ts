import { compterNonLusParConversation } from '#server/utils/messenger-unread-service'

/** Ce qu'une candidature doit porter pour qu'on sache où chercher ses messages. */
interface CandidatureAvecConversation {
  id: number
  conversation: { id: string } | null
}

/**
 * Les messages non lus de chaque candidature, pour une liste entière et en une requête.
 *
 * ## ⚠️ POURQUOI CET UTIL PLUTÔT QU'UN POINT D'API PAR CANDIDATURE
 *
 * Il existait `GET /api/show-applications/[id]/unread-count`, et **personne ne l'appelait** : un
 * balayage de `apps/app1/app` et des dossiers `app` de tous les layers ne trouvait aucun appelant.
 * Du code mort, donc.
 *
 * 📍 Écrit en toutes lettres plutôt qu'avec un chemin à joker : `layers/<étoile>/app` referme le
 * commentaire de bloc sur sa séquence `*` + `/`, et tout ce qui suit est alors lu comme du code.
 * C'est ce qui est arrivé en écrivant cette fiche — le fichier ne compilait plus, trente lignes
 * plus bas.
 *
 * ⚠️⚠️ MAIS PAS SEULEMENT MORT : **DIVERGENT**, et c'est la vraie raison de le supprimer plutôt
 * que de le brancher. Il comptait les non-lus d'une façon qui n'est pas celle du reste de la
 * messagerie :
 *
 * | | le point d'API mort | `compterNonLusParConversation` |
 * | --- | --- | --- |
 * | repère de lecture | `lastReadMessageId`, puis son `createdAt` | `lastReadAt` |
 * | ses propres messages | **comptés** | exclus (`m.participantId <> cp.id`) |
 * | nombre de requêtes | 2 ou 3, par candidature | 1, pour toute la liste |
 *
 * Il aurait donc annoncé à l'organisateur **ses propres messages comme non lus** — une pastille
 * qui ne s'éteint jamais, puisque répondre l'aurait fait monter. Le brancher tel quel aurait
 * installé une troisième réponse à « combien de non-lus ? » dans un dépôt qui en a déjà payé le
 * prix ailleurs.
 *
 * ## 📍 ZÉRO POUR QUI N'EST PAS PARTICIPANT, ET C'EST UN CHOIX
 *
 * `compterNonLusParConversation` ne regarde que les conversations où la personne est inscrite
 * (`cp.userId = … AND cp.leftAt IS NULL`). L'énoncé du constat proposait, pour un organisateur
 * **non** participant, d'afficher le **total** des messages de la conversation.
 *
 * C'est écarté : ce total annoncerait « 12 non lus » à quelqu'un qui les a peut-être tous lus, et
 * une pastille fausse est pire qu'une pastille absente — elle pousse à ouvrir pour rien, puis on
 * cesse de la croire. Les organisateurs habilités SONT inscrits à la conversation d'une
 * candidature (c'est ce que fait `messenger-show-application`), donc le cas ne concerne que des
 * conversations anciennes ou des droits qui ne couvrent pas les artistes — pour lesquels ne rien
 * afficher est la bonne réponse.
 *
 * @returns une `Map` indexée par **identifiant de candidature**, ne contenant que celles qui ont
 *   au moins un message non lu. L'appelant lit `?? 0` : il n'a pas à distinguer « absente » de
 *   « zéro ».
 */
export async function nonLusParCandidature(
  candidatures: CandidatureAvecConversation[],
  userId: number
): Promise<Map<number, number>> {
  const avecConversation = candidatures.filter((c) => c.conversation)
  // Aucune conversation dans la liste : la requête n'aurait rien à compter.
  if (avecConversation.length === 0) return new Map()

  const parConversation = await compterNonLusParConversation(userId)

  const resultat = new Map<number, number>()
  for (const candidature of avecConversation) {
    const nonLus = parConversation.get(candidature.conversation!.id)
    if (nonLus) resultat.set(candidature.id, nonLus)
  }
  return resultat
}
