import type { H3Event } from 'h3'

/**
 * Lance un travail sans faire attendre le client.
 *
 * Pour les diffusions en masse — notifications, courriels — qui n'ont rien à apprendre à celui qui
 * les déclenche : il a besoin de savoir que c'est parti et à combien de personnes, pas d'attendre
 * le dernier envoi. Bloquer la réponse sur une centaine d'envois séquentiels, c'est un bouton qui
 * tourne une minute, et un organisateur qui recharge la page en croyant à une panne.
 *
 * `event.waitUntil` existe bien dans ce Nitro (2.13.4) : il empile la promesse et la transmet à la
 * plate-forme quand celle-ci en propose un — sur un serveur Node, personne ne l'attend, ce qui est
 * exactement l'effet voulu. Le repli `setImmediate` couvre les contextes où il n'existe pas, dont
 * les tests, où l'événement est un objet nu.
 *
 * Les rejets sont rattrapés ici : une promesse orpheline qui échoue remonterait en
 * `unhandledRejection`, et il n'y a plus personne pour lui répondre.
 *
 * ⚠️ CE QUI NE PASSE PAS PAR ICI : tout ce dont la réponse doit rendre compte. Le travail différé
 * ne peut plus rien dire au client — ni un compte d'échecs, ni un identifiant créé. Ce qu'il faut
 * annoncer se calcule AVANT, et la réponse porte alors le nombre de destinataires et non le nombre
 * d'envois réussis. Les deux se ressemblent assez pour qu'on les confonde.
 *
 * ⚠️ ET CE QUI DOIT ÊTRE ÉCRIT AVANT : une marque d'idempotence. Un travail différé s'exécute après
 * que la réponse est partie, donc après qu'un second appel a pu commencer. Poser la marque dans le
 * travail différé laisse deux diffusions se croiser.
 *
 * Extrait de `shows-call/[showCallId]/index.put.ts`, qui le portait en local, au moment du second
 * emploi — la publication du planning des bénévoles.
 */
export function apresLaReponse(
  event: H3Event,
  travail: () => Promise<void>,
  contexte: string
): void {
  const lancer = () =>
    travail().catch((erreur) => {
      console.error(`[${contexte}] travail après réponse échoué`, erreur)
    })

  const { waitUntil } = event as H3Event & { waitUntil?: (p: Promise<unknown>) => void }

  if (typeof waitUntil === 'function') {
    // La VRAIE promesse, pas une enveloppe déjà résolue : là où la plate-forme l'honore, elle
    // maintient le processus en vie le temps de la diffusion.
    waitUntil.call(event, lancer())
    return
  }

  setImmediate(lancer)
}

/**
 * Découpe une liste en tranches de taille fixe.
 *
 * Pour envoyer par lots plutôt que tout en parallèle : cent requêtes simultanées vers un service de
 * courriel se font refuser, et une boucle séquentielle prend une minute. La tranche borne le nombre
 * de requêtes en vol sans renoncer au parallélisme.
 */
export function enTranches<T>(elements: readonly T[], taille: number): T[][] {
  const tranches: T[][] = []
  for (let i = 0; i < elements.length; i += taille) {
    tranches.push(elements.slice(i, i + taille))
  }
  return tranches
}
