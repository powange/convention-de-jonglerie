import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { listerCandidats, type Verdict } from '#server/utils/veille-candidats'
import { SOURCES } from '#server/utils/veille-sources'

/** Les verdicts acceptés en filtre. Une valeur inconnue ne filtre pas, comme ailleurs dans l'admin. */
const VERDICTS: readonly Verdict[] = ['A_EXAMINER', 'CONVENTION', 'REFUSE']

/**
 * Les avis de modèle acceptés en filtre, plus `AUCUN` pour ceux qu'il n'a pas encore vus.
 *
 * ⚠️ `AUCUN` doit être une valeur à part entière : c'est la file de ce qui reste à soumettre, et
 * la confondre avec « pas de filtre » rendrait le reste à faire invisible depuis l'écran.
 */
const AVIS: readonly string[] = ['CONVENTION', 'HORS_SUJET', 'INCERTAIN', 'AUCUN']

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

    const avisDemande = String(requete.avisIa ?? '')
    const avisIa = AVIS.includes(avisDemande)
      ? (avisDemande as 'CONVENTION' | 'HORS_SUJET' | 'INCERTAIN' | 'AUCUN')
      : undefined

    const candidats = await listerCandidats({
      verdict,
      avisIa,
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

    /*
     * Les comptes par avis de modèle, pris de la même façon : sur toute la table, sans les filtres.
     *
     * ⚠️ Restreints à `verdict: A_EXAMINER`, et c'est délibéré : l'avis ne sert à trier que ce qui
     * n'est pas encore tranché. Compter les avis sur des candidats déjà retenus ou refusés par un
     * humain gonflerait les nombres avec du travail déjà fait, et le « reste à classer » affiché
     * serait faux.
     *
     * 📍 `groupBy` ne rend AUCUNE ligne pour les `NULL` de `avisIa` sur certains moteurs, et c'est
     * précisément la file des non classés — la plus utile. Elle est donc comptée à part.
     */
    const [parAvis, sansAvis] = await Promise.all([
      prisma.candidatEvenement.groupBy({
        by: ['avisIa'],
        where: { verdict: 'A_EXAMINER' },
        _count: { _all: true },
      }),
      prisma.candidatEvenement.count({ where: { verdict: 'A_EXAMINER', avisIa: null } }),
    ])

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
      comptesAvis: {
        CONVENTION: parAvis.find((l) => l.avisIa === 'CONVENTION')?._count._all ?? 0,
        HORS_SUJET: parAvis.find((l) => l.avisIa === 'HORS_SUJET')?._count._all ?? 0,
        INCERTAIN: parAvis.find((l) => l.avisIa === 'INCERTAIN')?._count._all ?? 0,
        // Ce qui reste à soumettre au modèle. C'est le seul de ces quatre nombres sur lequel
        // l'opérateur peut agir, d'où son comptage à part plutôt qu'au travers du `groupBy`.
        AUCUN: sansAvis,
      },
    })
  },
  { operationName: 'ListerCandidatsVeille' }
)
