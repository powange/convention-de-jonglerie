import type { CandidatExterne } from './sources-evenements'

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
