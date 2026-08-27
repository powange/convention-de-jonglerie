import { z } from 'zod'

/**
 * Les règles qu'un mot de passe doit respecter, en un seul endroit.
 *
 * Elles étaient jusqu'ici recopiées dans le schéma serveur, dans les quatre formulaires qui
 * demandent un mot de passe, et dans deux calculs de « force » indépendants. Le compteur de
 * force n'en connaissait qu'une partie : un mot de passe long, avec une majuscule et un
 * caractère spécial mais sans chiffre s'affichait « fort » en vert, puis se faisait refuser à
 * la validation pour absence de chiffre. Deux copies des mêmes règles finissent toujours par
 * diverger — d'où ce module, dont dépendent désormais le serveur comme l'interface.
 *
 * Ce module ne dépend ni du réseau ni de la base : il se teste sur des chaînes.
 */

/** Une exigence, et de quoi la vérifier. */
export interface RegleMotDePasse {
  /** Identifiant stable, utilisé comme clé de liste et dans les tests. */
  cle: 'longueur' | 'majuscule' | 'chiffre'
  /** Clé i18n du libellé affiché dans la liste des exigences. */
  cleLibelle: string
  /** Clé i18n du message d'erreur, pour les formulaires. */
  cleErreur: string
  /** Message français, pour le schéma serveur qui ne dispose pas de l'i18n. */
  messageServeur: string
  verifie: (motDePasse: string) => boolean
}

export const LONGUEUR_MINIMALE = 8

/** Les exigences, dans l'ordre où elles sont présentées à l'utilisateur. */
export const REGLES_MOT_DE_PASSE: readonly RegleMotDePasse[] = [
  {
    cle: 'longueur',
    cleLibelle: 'auth.password_rule_length',
    cleErreur: 'errors.password_too_short',
    messageServeur: `Le mot de passe doit contenir au moins ${LONGUEUR_MINIMALE} caractères`,
    verifie: (motDePasse) => motDePasse.length >= LONGUEUR_MINIMALE,
  },
  {
    cle: 'majuscule',
    cleLibelle: 'auth.password_rule_uppercase',
    cleErreur: 'errors.password_uppercase_required',
    messageServeur: 'Le mot de passe doit contenir au moins une majuscule',
    verifie: (motDePasse) => /[A-Z]/.test(motDePasse),
  },
  {
    cle: 'chiffre',
    cleLibelle: 'auth.password_rule_digit',
    cleErreur: 'errors.password_digit_required',
    messageServeur: 'Le mot de passe doit contenir au moins un chiffre',
    verifie: (motDePasse) => /\d/.test(motDePasse),
  },
]

/** État de chaque exigence pour un mot de passe donné. */
export function evaluerReglesMotDePasse(motDePasse: string) {
  return REGLES_MOT_DE_PASSE.map((regle) => ({
    cle: regle.cle,
    cleLibelle: regle.cleLibelle,
    satisfaite: regle.verifie(motDePasse),
  }))
}

/** Le mot de passe passera-t-il la validation ? */
export const motDePasseValide = (motDePasse: string) =>
  REGLES_MOT_DE_PASSE.every((regle) => regle.verifie(motDePasse))

/**
 * Bonus de robustesse : ni exigé ni bloquant, il ne sert qu'à distinguer un mot de passe
 * valide d'un mot de passe valide *et* solide.
 */
export const aBonusRobustesse = (motDePasse: string) =>
  /[^a-zA-Z0-9]/.test(motDePasse) || motDePasse.length > 12

/**
 * Score de 0 à 4, pour la barre de force. Il ne remplace pas {@link motDePasseValide} :
 * un mot de passe peut marquer des points tout en manquant une exigence obligatoire.
 */
export function forceMotDePasse(motDePasse: string): number {
  if (!motDePasse) return 0
  const satisfaites = REGLES_MOT_DE_PASSE.filter((regle) => regle.verifie(motDePasse)).length
  return satisfaites + (aBonusRobustesse(motDePasse) ? 1 : 0)
}

/**
 * Schéma zod bâti sur ces mêmes règles. Le passer partout garantit qu'un formulaire ne peut
 * plus exiger autre chose que ce que la liste affiche, ni que le serveur.
 *
 * @param traduire - Traducteur i18n côté client ; omis, les messages français sont utilisés.
 */
export function schemaMotDePasse(traduire?: (cle: string) => string) {
  return z.string().superRefine((valeur, contexte) => {
    for (const regle of REGLES_MOT_DE_PASSE) {
      if (regle.verifie(valeur)) continue
      contexte.addIssue({
        code: 'custom',
        message: traduire ? traduire(regle.cleErreur) : regle.messageServeur,
      })
    }
  })
}
