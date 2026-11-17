import type { TreasuryLine } from './treasury-compute'

import { normaliserCoordonneeBancaire } from '~~/shared/utils/coordonnees-bancaires'

/**
 * Les versements à faire : ce que l'édition doit à des TIERS.
 *
 * ## ⚠️ À NE PAS CONFONDRE AVEC LES AVANCES
 *
 * `avancesARembourser` (dans `treasury-compute.ts`) totalise ce que l'édition doit à des gens de
 * son équipe, qui ont payé de leur poche. Ce module-ci totalise ce qu'elle doit à des tiers
 * extérieurs, qui attendent un virement.
 *
 * Les deux se paient souvent de la même façon, et les confondre fait payer deux fois ou pas du
 * tout. L'invariant posé au lot précédent garantit qu'une ligne n'appartient jamais aux deux :
 * une dépense est soit avancée, soit à régler.
 *
 * ⚠️ Le code existant appelle `parBeneficiaire` le regroupement DES AVANCES. Le mot est donc pris,
 * et c'est pourquoi on parle ici de « versements » et de « destinataires ».
 */

/** Une dépense qui attend son virement. */
export interface LigneAVerser {
  cle: string
  libelle: string
  /** Montant dû, en centimes : réglé ET engagé confondus — voir la note du regroupement. */
  montant: number
  code: { code: string; label: string } | null
}

/** Un destinataire et ce qu'on lui doit. */
export interface DestinataireDeVersement {
  /** La clé de regroupement : l'IBAN normalisé s'il existe, sinon l'identifiant du bénéficiaire. */
  cle: string
  payeeId: number
  label: string
  iban: string | null
  bic: string | null
  montant: number
  lignes: LigneAVerser[]
}

export interface VersementsAFaire {
  total: number
  destinataires: DestinataireDeVersement[]
}

/** Le carnet, réduit à ce dont le regroupement a besoin. */
export interface BeneficiaireConnu {
  id: number
  label: string
  iban: string | null
  bic: string | null
}

/**
 * Regroupe les dépenses à régler, par destinataire.
 *
 * ## ⚠️ L'ASYMÉTRIE AVEC LES AVANCES, et elle est volontaire
 *
 * `avancesARembourser` EXCLUT les lignes prévisionnelles : rien n'est encore sorti de la poche de
 * personne, il n'y a donc rien à rembourser. Ici c'est **l'inverse** : une dépense prévisionnelle à
 * régler est exactement ce qu'on doit payer. L'exclure viderait la carte de sa raison d'être — un
 * devis signé non encore viré est le cas le plus courant.
 *
 * C'est pourquoi le montant retenu est `settled + pending`, et non `settled` seul : une ligne
 * prévisionnelle porte son montant dans `pending`, et ne regarder que `settled` l'y ferait compter
 * pour zéro. Le total serait alors juste — et dramatiquement sous-évalué.
 *
 * ## La clé de regroupement
 *
 * 📍 L'IBAN NORMALISÉ quand il existe, et non l'identifiant du bénéficiaire. Deux fiches distinctes
 * peuvent porter le même compte — un prestataire saisi deux fois sous deux noms —, et c'est UN
 * virement qu'il faut faire, pas deux. Sans IBAN, on retombe sur l'identifiant : deux fiches sans
 * coordonnées restent séparées, faute de quoi on les fusionnerait sur la foi d'une homonymie.
 */
export function versementsAFaire(
  lines: TreasuryLine[],
  carnet: BeneficiaireConnu[]
): VersementsAFaire {
  const parId = new Map(carnet.map((beneficiaire) => [beneficiaire.id, beneficiaire]))
  const parDestinataire = new Map<string, DestinataireDeVersement>()

  for (const line of lines) {
    // `disbursed` : déjà versé, il n'y a plus rien à faire. `settled` serait un MONTANT ici.
    if (line.kind !== 'EXPENSE' || !line.payeeId || line.disbursed) continue

    const beneficiaire = parId.get(line.payeeId)
    // Un bénéficiaire absent du carnet ne devrait pas arriver — la clé étrangère l'empêche —, mais
    // l'ignorer silencieusement ferait disparaître un montant dû. On le garde sous son identifiant.
    const label = beneficiaire?.label ?? `#${line.payeeId}`
    const iban = beneficiaire?.iban ? normaliserCoordonneeBancaire(beneficiaire.iban) : null

    const cle = iban ? `i:${iban}` : `p:${line.payeeId}`
    const montant = line.settled + (line.pending ?? 0)

    /*
     * ⚠️ LES LIGNES SONT COLLECTÉES ICI, dans la boucle qui applique déjà la règle — et non
     * regroupées une seconde fois côté client. Le filtre et la clé sont subtils : les recopier
     * ailleurs ferait deux règles à tenir en accord, et un détail qui ne somme pas à son propre
     * total ne se remarque qu'en recomptant à la main.
     */
    const ligne: LigneAVerser = {
      cle: line.key,
      libelle: line.title,
      montant,
      code: line.code ? { code: line.code.code, label: line.code.label } : null,
    }

    const deja = parDestinataire.get(cle)
    if (deja) {
      deja.montant += montant
      deja.lignes.push(ligne)
      continue
    }
    parDestinataire.set(cle, {
      cle,
      payeeId: line.payeeId,
      label,
      iban,
      bic: beneficiaire?.bic ?? null,
      montant,
      lignes: [ligne],
    })
  }

  const destinataires = [...parDestinataire.values()].sort((a, b) => b.montant - a.montant)
  // Le même ordre à l'intérieur qu'à l'extérieur : le plus gros montant d'abord, c'est celui qu'on
  // vérifie en premier quand on contrôle une somme.
  for (const destinataire of destinataires) {
    destinataire.lignes.sort((a, b) => b.montant - a.montant)
  }

  return {
    total: destinataires.reduce((somme, d) => somme + d.montant, 0),
    destinataires,
  }
}
