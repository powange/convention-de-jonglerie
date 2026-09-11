/**
 * Ce qu'emporte la suppression d'un groupe de stock.
 *
 * La base est en cascade : effacer un groupe efface ses objets, et chaque objet emporte ses
 * réservations. La confirmation n'annonçait que les objets — or ce sont les réservations qui font
 * mal, parce qu'elles ont été posées par d'autres. Quelqu'un qui comptait sur du matériel pour
 * son spectacle le perd sans avoir été prévenu, et sans que celui qui supprime l'ait su.
 *
 * La règle vit ici parce qu'elle décide de ce qu'on annonce avant un geste irréversible, et qu'un
 * décompte faux vaudrait mieux ne pas exister : mieux vaut ne rien dire que rassurer à tort.
 */

/** Un objet du groupe, réduit à ce qui compte pour la confirmation. */
export interface ObjetSupprimable {
  /**
   * Le nombre de réservations de cet objet, tel que l'API le rend.
   *
   * Toutes sont comptées, y compris les annulées et les rendues : la cascade ne fait pas le tri,
   * et annoncer moins que ce qui disparaît serait mentir par omission.
   */
  _count?: { reservations?: number } | null
}

/** Ce que la confirmation doit annoncer. */
export interface ResumeSuppression {
  objets: number
  reservations: number
}

/**
 * Le décompte de ce qui part.
 *
 * Un objet dont le compte manque est traité comme n'en ayant aucune plutôt que d'être écarté :
 * une API qui aurait cessé de rendre ce champ ferait sinon disparaître des objets du décompte,
 * et l'on annoncerait moins d'objets qu'il n'y en a — l'erreur la plus dangereuse des deux.
 */
export function resumeSuppressionGroupe(objets: ObjetSupprimable[]): ResumeSuppression {
  return {
    objets: objets.length,
    reservations: objets.reduce((total, objet) => total + (objet._count?.reservations ?? 0), 0),
  }
}
