import { synchroniserParticipantsDesFilsDeBenevoles } from '#server/utils/messenger-helpers'

/**
 * Remet les fils « bénévole ↔ organisateurs » en accord avec les droits, après une modification.
 *
 * ⚠️ POURQUOI UN MODULE À PART plutôt que deux appels recopiés. Deux points d'API modifient les
 * droits d'un organisateur — un PATCH partiel et un PUT complet — et ils n'ont ni la même forme de
 * corps, ni la même façon de rendre les permissions par édition. C'est exactement le genre de
 * paire qui finit par diverger : l'un synchroniserait, l'autre non, et la fuite ne serait fermée
 * qu'une fois sur deux, sans que rien ne dise laquelle.
 *
 * ⚠️ ON SYNCHRONISE LARGE : TOUTES les éditions de la convention, pas seulement celles dont les
 * permissions particulières ont bougé. Le droit de gérer les bénévoles peut être GLOBAL à la
 * convention, auquel cas il vaut pour toutes ses éditions d'un coup ; ne traiter que les éditions
 * citées dans le corps de la requête laisserait la fuite ouverte partout ailleurs — c'est-à-dire
 * là où l'on croirait précisément l'avoir fermée.
 *
 * Le coût reste modeste : la synchronisation ne lit que les fils de type
 * `VOLUNTEER_TO_ORGANIZERS`, et n'écrit que les participations qui doivent réellement changer.
 * Une convention sans bénévolat n'a aucun fil, donc rien à faire.
 */
export async function synchroniserApresChangementDeDroits(conventionId: number): Promise<void> {
  /*
   * ⚠️ RIEN NE DOIT REMONTER D'ICI, et une première version ne tenait pas cette promesse : seule
   * la boucle était protégée, pas la LECTURE des éditions. Une base indisponible à cet instant
   * précis faisait donc échouer tout le point d'API — alors que la modification de droits, elle,
   * était déjà enregistrée. L'administrateur voyait une erreur 500 sur une opération réussie, et
   * la relançait.
   *
   * Les tests des deux points d'API l'ont montré avant la mise en ligne, ce qui est précisément
   * leur intérêt : le commentaire affirmait le contraire de ce que le code faisait.
   */
  let editions: { id: number }[]
  try {
    editions = await prisma.edition.findMany({
      where: { conventionId },
      select: { id: true },
    })
  } catch (erreur) {
    console.error(
      `[messagerie] éditions illisibles pour la convention ${conventionId}, fils non synchronisés :`,
      erreur
    )
    return
  }

  for (const edition of editions ?? []) {
    try {
      await synchroniserParticipantsDesFilsDeBenevoles(edition.id)
    } catch (erreur) {
      /*
       * Une édition en échec ne doit pas empêcher les suivantes : laisser la moitié des éditions
       * non synchronisées serait pire que d'en manquer une seule. Le droit fait foi de toute
       * façon — le contrôle d'accès de chaque écran le relit —, ces fils n'en sont que le reflet
       * dans la messagerie.
       */
      console.error(
        `[messagerie] synchronisation des fils de bénévoles impossible pour l'édition ${edition.id} :`,
        erreur
      )
    }
  }
}
