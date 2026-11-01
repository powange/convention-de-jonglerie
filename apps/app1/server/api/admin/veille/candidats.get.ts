import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { listerCandidats, type Verdict } from '#server/utils/veille-candidats'
import { SOURCES } from '#server/utils/veille-sources'

/** Les verdicts acceptés en filtre. Une valeur inconnue ne filtre pas, comme ailleurs dans l'admin. */
const VERDICTS: readonly Verdict[] = ['A_EXAMINER', 'CONVENTION', 'REFUSE']

/**
 * Les candidats de la veille, pour l'écran d'administration.
 *
 * Rend aussi de quoi peupler les filtres — sources déclarées, pays rencontrés, comptes par verdict.
 * Les calculer ici plutôt que côté client évite que l'écran déduise les pays de la page courante :
 * avec une pagination, il n'en verrait qu'une partie et proposerait un filtre incomplet.
 */
export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const requete = getQuery(event)
    const verdictDemande = String(requete.verdict ?? '')
    const verdict = VERDICTS.includes(verdictDemande as Verdict)
      ? (verdictDemande as Verdict)
      : undefined

    const candidats = await listerCandidats({
      verdict,
      source: requete.source ? String(requete.source) : undefined,
      pays: requete.pays ? String(requete.pays) : undefined,
      masquerImportes: requete.masquerImportes === 'true',
    })

    /*
     * Les comptes par verdict sont pris sur TOUTE la table, sans les filtres : ils servent d'onglets
     * (« à examiner 12 · retenus 3 · refusés 40 »), et un compte filtré par lui-même afficherait
     * toujours le même nombre que la liste — donc n'informerait de rien.
     */
    const parVerdict = await prisma.candidatEvenement.groupBy({
      by: ['verdict'],
      _count: { _all: true },
    })

    return createSuccessResponse({
      candidats,
      // Toutes les sources déclarées, même celles qui n'ont encore rien rapporté : leur absence
      // dans le filtre laisserait croire qu'elles ne sont pas branchées.
      sources: SOURCES.map((source) => ({
        cle: source.cle,
        nom: source.nom,
        urlDeLaListe: source.urlDeLaListe,
      })),
      pays: [
        ...new Set(
          (
            await prisma.candidatEvenement.findMany({
              where: { pays: { not: null } },
              select: { pays: true },
              distinct: ['pays'],
            })
          )
            .map((ligne) => ligne.pays)
            .filter((pays): pays is string => Boolean(pays))
        ),
      ].sort((a, b) => a.localeCompare(b, 'fr')),
      comptes: Object.fromEntries(
        VERDICTS.map((v) => [v, parVerdict.find((ligne) => ligne.verdict === v)?._count._all ?? 0])
      ),
    })
  },
  { operationName: 'ListerCandidatsVeille' }
)
