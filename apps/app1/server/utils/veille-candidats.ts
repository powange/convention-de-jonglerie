import { cleDeRapprochement } from './veille-sources'

import type { CandidatExterne } from './sources-evenements'
import type { AvisIa } from './veille-classement'

/**
 * Le rangement des candidats de la veille, et les verdicts qu'on leur pose.
 *
 * Le contrat d'une source vit dans `sources-evenements.ts` ; ce module-ci ne fait que ranger ce
 * qu'elle a dit et retenir ce qu'un administrateur en a décidé.
 */

/** Les verdicts, tels que l'énumération Prisma les nomme. */
export type Verdict = 'A_EXAMINER' | 'CONVENTION' | 'REFUSE'

/** Ce que l'enregistrement d'une liste a produit, pour le dire à l'écran. */
export interface BilanEnregistrement {
  /** Candidats que la source vient de faire découvrir. */
  nouveaux: number
  /** Candidats déjà connus, dont la description a été rafraîchie. */
  rafraichis: number
}

/**
 * Range une liste de candidats, en PRÉSERVANT les verdicts déjà posés.
 *
 * ## ⚠️ L'INVARIANT DE CE MODULE
 *
 * Un `verdict` déjà en base n'est JAMAIS réécrit par une énumération. C'est exactement ce que
 * « je ne veux pas que ça me le repropose à chaque fois » demande : le refus d'un administrateur
 * est définitif, et une source qui re-liste l'événement le lendemain ne doit pas l'effacer.
 *
 * On met donc à jour ce que la source DÉCRIT — titre, dates, durée, lieu — et on laisse intact ce
 * qu'un humain a DÉCIDÉ. Les deux ne se mélangent pas.
 *
 * 📍 La clé est l'URL canonique, et elle seule. Ni le titre ni les dates : un agenda qui corrige
 * l'orthographe d'un nom ou décale un événement d'un jour ne doit pas créer un second candidat et
 * faire réapparaître ce qu'on avait écarté.
 */
export async function enregistrerCandidats(
  source: string,
  candidats: readonly CandidatExterne[]
): Promise<BilanEnregistrement> {
  let nouveaux = 0
  let rafraichis = 0

  for (const candidat of candidats) {
    const decrit = {
      source,
      identifiantSource: candidat.identifiantSource,
      titre: candidat.titre,
      debut: candidat.debut ? new Date(candidat.debut) : null,
      jours: candidat.jours,
      pays: candidat.pays,
      lieu: candidat.lieu,
      adresse: candidat.adresse,
    }

    /*
     * `upsert` plutôt que « chercher puis créer ou modifier » : entre les deux requêtes, un second
     * passage de la veille pourrait insérer la même URL et faire échouer la création sur l'unicité.
     *
     * ⚠️ `update` ne contient PAS `verdict` — c'est là que l'invariant se joue, et c'est la seule
     * ligne de ce module qu'il ne faut pas « simplifier » en réutilisant l'objet de création.
     */
    const existant = await prisma.candidatEvenement.findUnique({
      where: { url: candidat.url },
      select: { id: true },
    })

    await prisma.candidatEvenement.upsert({
      where: { url: candidat.url },
      create: { ...decrit, url: candidat.url },
      update: decrit,
    })

    if (existant) rafraichis++
    else nouveaux++
  }

  return { nouveaux, rafraichis }
}

/**
 * Pose le verdict d'un administrateur sur un candidat.
 *
 * `verdictLe` accompagne le verdict : il dit quand la décision a été prise, là où `majLe` ne dit
 * que quand la ligne a bougé pour une raison quelconque — un rafraîchissement de description, par
 * exemple. Confondre les deux ferait croire qu'une décision est récente alors que seule la source
 * a parlé.
 */
export async function poserVerdict(url: string, verdict: Verdict): Promise<void> {
  await prisma.candidatEvenement.update({
    where: { url },
    data: { verdict, verdictLe: new Date() },
  })
}

/**
 * Les clés de rapprochement des événements DÉJÀ importés, lues sur les éditions existantes.
 *
 * ## ⚠️ Pourquoi un ensemble de clés et non une comparaison d'URL
 *
 * MESURÉ : les éditions importées depuis JugglingEdge portent leur URL d'origine sur `www.` ou
 * `fr.`, là où l'énumération de l'agenda canonicalise sans sous-domaine. Trois écritures pour un
 * même événement — une comparaison de chaînes n'en apparierait aucune, et l'écran reproposerait
 * indéfiniment ce qui est déjà en base. Le rapprochement passe donc par la clé que chaque source
 * sait calculer (voir `veille-sources.ts`).
 *
 * 📍 Les TROIS champs d'origine sont lus, pas seulement `jugglingEdgeUrl` : une convention a pu
 * être importée depuis son événement Facebook ou son site officiel, et l'agenda peut la lister
 * quand même. Ne regarder qu'un champ reviendrait à la reproposer.
 */
export async function clesDesEvenementsImportes(): Promise<Set<string>> {
  const editions = await prisma.edition.findMany({
    where: {
      OR: [
        { jugglingEdgeUrl: { not: null } },
        { facebookUrl: { not: null } },
        { officialWebsiteUrl: { not: null } },
      ],
    },
    select: { jugglingEdgeUrl: true, facebookUrl: true, officialWebsiteUrl: true },
  })

  const cles = new Set<string>()
  for (const edition of editions) {
    for (const url of [edition.jugglingEdgeUrl, edition.facebookUrl, edition.officialWebsiteUrl]) {
      if (!url) continue
      const cle = cleDeRapprochement(url)
      if (cle) cles.add(cle)
    }
  }
  return cles
}

/** Un candidat tel que l'écran le reçoit : ce qu'on a rangé, plus ce qui se calcule. */
export interface CandidatPourEcran {
  id: number
  source: string
  url: string
  titre: string
  debut: Date | null
  jours: number | null
  pays: string | null
  lieu: string | null
  adresse: string | null
  verdict: Verdict
  verdictLe: Date | null
  decouvertLe: Date
  /** L'avis du modèle, ou `null` s'il ne l'a pas encore vu. Un AVIS, jamais une décision. */
  avisIa: AvisIa | null
  avisIaLe: Date | null
  motifIa: string | null
  /** Calculé, jamais rangé : voir l'énumération `VerdictCandidat` du schéma. */
  dejaImporte: boolean
}

/** Les filtres que l'écran applique. Une valeur absente ne filtre pas. */
export interface FiltresCandidats {
  verdict?: Verdict
  source?: string
  pays?: string
  /**
   * L'avis du modèle, ou `AUCUN` pour ceux qu'il n'a pas encore vus.
   *
   * ⚠️ `AUCUN` ne peut pas s'écrire comme une valeur absente : « pas de filtre » et « filtrer sur
   * l'absence d'avis » sont deux demandes différentes, et les confondre rendrait la file des non
   * classés inatteignable — donc le reste à faire invisible.
   */
  avisIa?: AvisIa | 'AUCUN'
  /** Masquer ceux dont une édition existe déjà. Appliqué APRÈS la base, le calcul n'y vivant pas. */
  masquerImportes?: boolean
}

/**
 * Liste les candidats, en marquant ceux dont une édition existe déjà.
 *
 * ⚠️ `dejaImporte` se CALCULE à chaque appel, et n'est pas rangé en base. Le ranger obligerait à le
 * tenir à jour, et il se périmerait au premier import fait depuis un autre écran — une donnée
 * fausse mais plausible, qu'aucune alerte ne signalerait.
 */
export async function listerCandidats(
  filtres: FiltresCandidats = {}
): Promise<CandidatPourEcran[]> {
  const [rangees, importees] = await Promise.all([
    prisma.candidatEvenement.findMany({
      where: {
        ...(filtres.verdict ? { verdict: filtres.verdict } : {}),
        ...(filtres.source ? { source: filtres.source } : {}),
        ...(filtres.pays ? { pays: filtres.pays } : {}),
        // `AUCUN` se traduit en `null`, et non en « pas de filtre » : c'est la file de ce qui
        // reste à soumettre au modèle, et elle doit pouvoir être demandée explicitement.
        ...(filtres.avisIa ? { avisIa: filtres.avisIa === 'AUCUN' ? null : filtres.avisIa } : {}),
      },
      orderBy: [{ debut: 'asc' }, { titre: 'asc' }],
    }),
    clesDesEvenementsImportes(),
  ])

  const enrichis = rangees.map((candidat) => ({
    ...candidat,
    dejaImporte: (() => {
      const cle = cleDeRapprochement(candidat.url)
      return cle ? importees.has(cle) : false
    })(),
  })) as CandidatPourEcran[]

  return filtres.masquerImportes ? enrichis.filter((c) => !c.dejaImporte) : enrichis
}
