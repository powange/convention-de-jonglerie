import type { UserForPermissions } from '#server/utils/permissions/types'

import { equipesDontIlEstResponsable } from '#server/utils/editions/volunteers/responsables-equipe'
import { isActiveAccessControlVolunteer } from '#server/utils/permissions/access-control-permissions'
import {
  canEditEdition,
  type EditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { canAccessMealValidation } from '#server/utils/permissions/meal-validation-permissions'

/**
 * Cette personne a-t-elle accès à l'espace de gestion d'une édition, à un titre quelconque ?
 *
 * C'est la question que pose la barre latérale de `edition-dashboard.vue` avant d'afficher un
 * lien, et elle a cinq réponses possibles : éditeur, organisateur de la convention, responsable
 * d'une équipe de bénévoles, habilité à la validation des repas, ou en créneau actif de contrôle
 * d'accès. Aucun droit de module là-dedans — c'est volontaire : le menu mène à des pages de
 * CONSULTATION autant qu'à des pages de modification.
 *
 * Elle existe parce qu'une route l'avait répondue autrement que le menu. La FAQ d'une édition
 * n'exemptait que le détenteur du droit `manageFAQ` ; un responsable d'équipe cliquait sur le lien
 * qu'on venait de lui proposer et recevait un 404, qui coupait le rendu de la page.
 *
 * ⚠️ Cette fonction dit qui peut ENTRER, jamais ce qu'il peut y faire. Le droit de modifier reste
 * au module (`canManageFAQ`, `canManageTasks`…), et l'appelant doit continuer à le vérifier à part
 * — c'est d'ailleurs ce que fait la FAQ, qui ne livre que les entrées publiques à qui entre par
 * ici.
 */
export async function aAccesGestionEdition(
  edition: EditionWithPermissions,
  user: UserForPermissions
): Promise<boolean> {
  // Les deux titres qui se lisent sur l'édition déjà chargée : aucune requête de plus, et ce sont
  // les deux cas les plus fréquents.
  if (canEditEdition(edition, user)) return true
  if (edition.convention.organizers?.some((organisateur) => organisateur.userId === user.id)) {
    return true
  }

  // Les trois titres de bénévole, qui demandent la base. En parallèle : on n'y arrive que si les
  // deux premiers ont dit non, et la réponse est alors rarement oui.
  const [equipes, repas, controle] = await Promise.all([
    equipesDontIlEstResponsable(edition.id, user.id).catch(() => [] as string[]),
    canAccessMealValidation(user.id, edition.id).catch(() => false),
    isActiveAccessControlVolunteer(user.id, edition.id).catch(() => false),
  ])

  return equipes.length > 0 || repas || controle
}
