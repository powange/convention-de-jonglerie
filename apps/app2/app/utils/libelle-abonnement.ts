/**
 * Comment nommer un abonnement à l'écran : « Duo annuel », et les modules qu'il couvre en clair.
 * Lu par le tableau de bord, le profil et l'administration.
 */
import { formule as definitionFormule, modulesCouverts } from '#shared/formules'
import { MODULES_EVENEMENT } from '#shared/modules-evenement'

/** « Duo annuel », « Intégral mensuel ». */
export function libelleFormuleAbonnement(cleFormule: string | null | undefined, plan?: string) {
  const nom = definitionFormule(cleFormule)?.libelle ?? 'Abonnement'
  return `${nom} ${plan === 'annual' ? 'annuel' : 'mensuel'}`
}

/** Les noms des modules couverts : « Bénévoles, Repas » ; « tous les modules » pour Intégral. */
export function libelleModulesCouverts(cleFormule: string | null | undefined, modules: unknown) {
  if (cleFormule === 'integral') return 'tous les modules'
  return modulesCouverts(cleFormule, modules)
    .map((cle) => MODULES_EVENEMENT.find((m) => m.cle === cle)?.libelle ?? cle)
    .join(', ')
}
