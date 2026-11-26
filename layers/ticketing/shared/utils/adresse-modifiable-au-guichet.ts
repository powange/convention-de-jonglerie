/**
 * Quand le guichet a le droit de réécrire l'adresse de courriel d'un compte.
 *
 * Ce champ existe pour une raison précise, et une seule : un artiste, un organisateur ou un
 * bénévole **ajouté à la main** se voit créer un compte au passage, et l'adresse saisie comporte
 * parfois une faute de frappe. Le guichet est l'endroit où l'on s'en aperçoit — la personne est
 * devant vous et vous lit son adresse.
 *
 * Il ne sert jamais à changer l'adresse de quelqu'un qui utilise déjà son compte. D'où la règle :
 * **tant que l'adresse n'est pas vérifiée, elle se corrige ; une fois vérifiée, elle est figée.**
 *
 * Cette règle n'est pas qu'une commodité, elle referme une porte. La connexion exige une adresse
 * vérifiée (`login.post.ts`) : un compte non vérifié n'est donc réclamé par personne, et en
 * corriger l'adresse ne prend le compte de personne. Un compte vérifié, lui, appartient à
 * quelqu'un — et comme la réinitialisation de mot de passe envoie son lien à l'adresse inscrite
 * sans rien exiger de plus, pouvoir la réécrire depuis le guichet revenait à pouvoir prendre le
 * compte. Le guichet est tenu, entre autres, par des bénévoles en créneau de contrôle d'accès.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Ce que la règle a besoin de savoir d'un compte. */
export interface CompteVise {
  id: number
  email: string
  isEmailVerified: boolean
}

/** Le verdict, pour un compte et une adresse soumise. */
export type VerdictDAdresse =
  /** L'adresse soumise est celle du compte : il n'y a rien à écrire. */
  | { decision: 'inchangee' }
  /** L'adresse diffère et le compte n'est pas vérifié : la correction est légitime. */
  | { decision: 'corrigeable' }
  /** L'adresse diffère et le compte est vérifié : on refuse. */
  | { decision: 'figee' }

/**
 * Deux adresses désignent-elles la même boîte, du point de vue de cette règle ?
 *
 * La casse et les espaces de bord ne comptent pas : l'écran pré-remplit le champ avec l'adresse
 * du compte, et un opérateur qui clique dans le champ sans rien changer peut tout de même en
 * renvoyer une variante. La traiter comme un changement ferait refuser une validation d'entrée
 * ordinaire — le pire résultat possible pour une file d'attente.
 */
function memeAdresse(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
}

/**
 * Ce que le guichet a le droit de faire de l'adresse soumise, pour UN compte.
 *
 * Une adresse absente vaut « on ne touche pas au champ » : les écrans envoient le bloc entier à
 * chaque validation, et l'absence n'est pas une demande de suppression.
 */
export function verdictDAdresse(
  compte: CompteVise,
  adresseSoumise: string | null | undefined
): VerdictDAdresse {
  if (adresseSoumise === undefined || adresseSoumise === null || adresseSoumise.trim() === '') {
    return { decision: 'inchangee' }
  }
  if (memeAdresse(adresseSoumise, compte.email)) return { decision: 'inchangee' }
  return compte.isEmailVerified ? { decision: 'figee' } : { decision: 'corrigeable' }
}

/**
 * Les comptes qui refusent la réécriture, parmi ceux qu'un appel vise.
 *
 * Rendus tels quels plutôt que sous forme d'un booléen : l'appelant a besoin de NOMMER ce qui
 * bloque. « L'adresse de ce compte est déjà vérifiée » se comprend au comptoir ; « opération
 * refusée » envoie chercher quelqu'un.
 */
export function comptesQuiRefusent(
  comptes: readonly CompteVise[],
  adresseSoumise: string | null | undefined
): CompteVise[] {
  return comptes.filter((compte) => verdictDAdresse(compte, adresseSoumise).decision === 'figee')
}

/**
 * Faut-il réellement écrire l'adresse ?
 *
 * Faux quand aucun compte visé ne change d'adresse : on évite alors une écriture inutile, et
 * surtout le recalcul d'une empreinte de gravatar identique à celle déjà enregistrée.
 */
export function adresseAEcrire(
  comptes: readonly CompteVise[],
  adresseSoumise: string | null | undefined
): boolean {
  return comptes.some(
    (compte) => verdictDAdresse(compte, adresseSoumise).decision === 'corrigeable'
  )
}
