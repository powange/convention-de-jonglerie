/**
 * Comment nommer un abonnement à l'écran : « Festival annuel », et ce que la formule comprend.
 * Lu par le tableau de bord, le profil et l'administration.
 */
import { COMPTEURS, FORMULE_GRATUITE, formule as definitionFormule } from '#shared/formules'

/** « Festival annuel », « Association mensuel » ; « Découverte (gratuite) » sans abonnement. */
export function libelleFormuleAbonnement(cleFormule: string | null | undefined, plan?: string) {
  if (!cleFormule || cleFormule === FORMULE_GRATUITE) return 'Découverte (gratuite)'
  const nom = definitionFormule(cleFormule)?.libelle ?? 'Abonnement'
  return `${nom} ${plan === 'annual' ? 'annuel' : 'mensuel'}`
}

/**
 * Les plafonds d'une formule en clair : « 1 événement en cours · 75 bénévoles · 20 artistes ·
 * 3 co-organisateurs par événement ». Formule inconnue ou absente : la gratuite.
 */
export function libellePlafondsFormule(cleFormule: string | null | undefined) {
  const f = definitionFormule(cleFormule) ?? definitionFormule(FORMULE_GRATUITE)!
  return COMPTEURS.map((c) => {
    const p = f.plafonds[c.cle]
    if (p === null) return `${c.libelle.toLowerCase()} illimités`
    // « par événement » une seule fois, à la fin.
    return c.unite(p).replace(' par événement', '')
  })
    .join(' · ')
    .concat(' par événement')
}
