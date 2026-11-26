import { prixRemise, resumeAvantage } from '../../../shared/codes-promo'
import { FORMULES, PERIODES } from '../../../shared/formules'
import { chargerCode, refusPourLeCompte } from '../../utils/codes-promo'

/**
 * Aperçu PUBLIC d'un code promo, lu par la page tarifs ouverte par un lien (`/pricing?code=…`) :
 * ce qu'il accorde, et le prix remisé de chaque formule et période qu'il couvre. Sans connexion, on
 * ne peut pas savoir si le compte l'a déjà utilisé ni s'il lui est réservé : le paiement revérifie
 * tout. Un code réservé à une autre adresse se dit introuvable.
 *
 * Répond toujours 200, avec `valide` : la page affiche la raison d'un refus sans la traiter en
 * erreur.
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const utilisateur = session.user as { id: number; email?: string } | undefined
  const code = await chargerCode(getRouterParam(event, 'code'))
  if (!code)
    return { valide: false as const, raison: 'Ce code est introuvable ou n’est plus valable' }

  const email = utilisateur
    ? ((await prisma.user.findUnique({ where: { id: utilisateur.id }, select: { email: true } }))
        ?.email ?? null)
    : null

  const prix: Record<string, Record<string, number | null>> = {}
  let premierRefus: string | null = null
  for (const f of FORMULES) {
    prix[f.cle] = {}
    for (const periode of PERIODES) {
      const refus = await refusPourLeCompte(code, {
        userId: utilisateur?.id ?? null,
        // Sans connexion, on ne juge pas l'adresse : on fait comme si c'était la bonne.
        email: utilisateur ? email : code.reservedEmail,
        formule: f.cle,
        periode,
      })
      prix[f.cle]![periode] = refus ? null : prixRemise(f.prix[periode], code)
      if (refus && !premierRefus) premierRefus = refus
    }
  }
  const applicable = Object.values(prix).some((p) => Object.values(p).some((v) => v !== null))
  if (!applicable) {
    return {
      valide: false as const,
      raison: premierRefus ?? 'Ce code ne s’applique à aucune formule',
    }
  }
  return {
    valide: true as const,
    code: code.code,
    resume: resumeAvantage(code),
    advantage: code.advantage,
    /** Prix remisé par formule et période (centimes), `null` là où le code ne vaut pas. */
    prix,
  }
})
