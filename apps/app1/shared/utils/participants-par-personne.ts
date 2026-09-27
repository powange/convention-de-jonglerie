import { cleIdentiteCivile } from './doublons-utilisateurs'

/**
 * Compter les participants d'une édition de DEUX façons : par billet, et par personne.
 *
 * Le contrôle d'accès affichait « 40 / 80 » en comptant des lignes de commande. Quelqu'un qui
 * prend un billet vendredi et un billet samedi y compte deux fois, au numérateur comme au
 * dénominateur : le même réel s'y lit « 40 sur 80 » là où il s'agit de 25 personnes sur 50. Les
 * deux lectures sont vraies et répondent à deux questions différentes — combien de billets ont
 * été scannés, combien de personnes sont entrées — d'où les deux comptes plutôt qu'un choix.
 *
 * Les deux sortent du MÊME tableau de billets, et c'est délibéré : tirés de deux requêtes
 * séparées, ils pourraient se contredire à l'écran pour la seule raison qu'une validation a eu
 * lieu entre les deux — un total regroupé supérieur au total par billet se lirait comme un bug.
 *
 * Fonction pure, testable sur des tableaux : c'est la règle de regroupement qui peut se tromper,
 * pas la requête qui l'alimente.
 */

export interface BilletACompter {
  firstName?: string | null
  lastName?: string | null
  entryValidated: boolean
  entryValidatedAt?: Date | string | null
}

export interface Progression {
  /** Attendus : tout ce qui compte comme participant, validé ou non. */
  total: number
  /** Entrés : au moins une validation. */
  valides: number
  /** Entrés depuis le début de la journée. */
  validesAujourdhui: number
}

export interface ComptesDeParticipants {
  billets: Progression
  personnes: Progression
}

/**
 * La clé qui rassemble les billets d'une même personne, ou `null` si ce billet ne peut se
 * rapprocher d'aucun autre.
 *
 * On réutilise `cleIdentiteCivile`, la règle que le rapprochement de comptes applique déjà, plutôt
 * que d'en écrire une seconde qui divergerait : minuscules, sans accents, espaces réduits, et
 * surtout **il faut le nom ET le prénom**. Un « Martin » sans prénom ne désigne pas une personne,
 * il désigne une famille — les rapprocher fusionnerait des inconnus.
 *
 * Conséquence assumée : un billet sans nom exploitable — l'ajout manuel au guichet en produit —
 * compte pour une personne à lui seul. Il n'est ni fondu avec les autres anonymes, ce qui
 * inventerait une personne, ni retiré du total, ce qui ferait disparaître un participant réel.
 */
export function cleDeRegroupement(billet: BilletACompter): string | null {
  return cleIdentiteCivile(billet.lastName, billet.firstName)
}

function valideAujourdhui(billet: BilletACompter, debutDuJour: Date): boolean {
  if (!billet.entryValidated || !billet.entryValidatedAt) return false
  return new Date(billet.entryValidatedAt).getTime() >= debutDuJour.getTime()
}

/**
 * Les deux progressions, à partir des billets qui comptent comme participants.
 *
 * `debutDuJour` est passé et non calculé ici : c'est l'appelant qui sait dans quel fuseau la
 * journée commence, et une fonction qui lit l'heure courante ne se teste pas.
 *
 * Une personne est comptée entrée dès qu'UN de ses billets est validé — elle est physiquement sur
 * le site, et c'est ce que le contrôle d'accès mesure. Attendre qu'ils le soient tous ferait
 * apparaître comme absente une personne présente dont le billet du lendemain n'est pas encore
 * scanné.
 */
export function compterLesParticipants(
  billets: BilletACompter[],
  debutDuJour: Date
): ComptesDeParticipants {
  const groupes = new Map<string, BilletACompter[]>()

  billets.forEach((billet, index) => {
    // Sans clé, le billet forme son propre groupe : l'index le rend unique sans le confondre
    // avec un autre anonyme.
    const cle = cleDeRegroupement(billet) ?? `sans-identite-${index}`
    const groupe = groupes.get(cle)
    if (groupe) groupe.push(billet)
    else groupes.set(cle, [billet])
  })

  const personnes = [...groupes.values()]

  return {
    billets: {
      total: billets.length,
      valides: billets.filter((b) => b.entryValidated).length,
      validesAujourdhui: billets.filter((b) => valideAujourdhui(b, debutDuJour)).length,
    },
    personnes: {
      total: personnes.length,
      valides: personnes.filter((groupe) => groupe.some((b) => b.entryValidated)).length,
      validesAujourdhui: personnes.filter((groupe) =>
        groupe.some((b) => valideAujourdhui(b, debutDuJour))
      ).length,
    },
  }
}
