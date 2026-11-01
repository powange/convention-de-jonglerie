import { demanderAuModele, extraireJson, type ConfigAppelTexte } from './appel-modele-texte'

/**
 * La classification automatique des candidats de la veille.
 *
 * ## Ce que ce module décide, et ce qu'il ne décide pas
 *
 * ⚠️ Il n'écrit JAMAIS `verdict`. Il remplit `avisIa`, `avisIaLe` et `motifIa`, et rien d'autre.
 * C'est l'invariant de tout le module : si l'avis du modèle atterrissait dans le verdict humain,
 * une relance automatique écraserait une décision prise à la main et un refus reviendrait au
 * balayage suivant — exactement ce que la fonctionnalité existe pour empêcher.
 *
 * 📍 L'avis TRIE, il ne MASQUE pas. Un candidat jugé hors sujet reste `A_EXAMINER` et reste
 * atteignable par un filtre dédié. Sans cela, une erreur du modèle ferait disparaître du travail
 * en silence, et c'est le défaut le plus coûteux possible ici : une convention jamais importée
 * dont personne ne sait qu'elle a été écartée.
 */

/** Les avis que l'énumération Prisma accepte. */
export type AvisIa = 'CONVENTION' | 'HORS_SUJET' | 'INCERTAIN'

const AVIS_VALIDES: readonly AvisIa[] = ['CONVENTION', 'HORS_SUJET', 'INCERTAIN']

/**
 * Le prompt système.
 *
 * Trois exigences, chacune contre un défaut observable :
 *
 * 1. **Plusieurs langues et plusieurs pays.** L'agenda liste des événements allemands, tchèques,
 *    espagnols… Un prompt qui ne parlerait que de français ferait écarter des conventions bien
 *    réelles sur le seul motif que leur titre n'est pas compris.
 * 2. **Le droit de ne pas trancher.** Sans `INCERTAIN`, un titre ambigu force le modèle à choisir,
 *    et il choisira — avec aplomb, et sans qu'on sache que c'était un coup de dé.
 * 3. **Un motif court et obligatoire.** C'est ce qui permet de juger un faux négatif sans rouvrir
 *    la page d'origine. Un avis sans motif oblige à tout revérifier, donc annule le gain.
 */
const PROMPT_SYSTEME = `Tu classes des événements d'un agenda en ligne pour savoir lesquels sont des CONVENTIONS DE JONGLERIE.

Une convention de jonglerie est un rassemblement de jongleurs, sur un ou plusieurs jours, avec en général des salles de pratique libre, des ateliers, un spectacle et parfois un camping. Les noms varient beaucoup selon les pays : « convention », « Jonglierfestival », « juggling festival », « encuentro de malabares », « žonglérský festival », « jongleertreffen »…

NE SONT PAS des conventions de jonglerie :
- un spectacle ou un festival de cirque où le public vient regarder, sans pratique collective ;
- un atelier ponctuel de quelques heures, un cours régulier, un entraînement hebdomadaire ;
- une compétition sportive seule (par exemple de diabolo ou de kendama) ;
- un festival d'arts de rue généraliste, un carnaval, une fête de la musique ;
- une rencontre de monocycle, de slackline ou d'acrobatie sans jonglerie.

Les événements te sont donnés dans N'IMPORTE QUELLE LANGUE et pour n'importe quel pays. Ne te fie pas à la langue : juge le contenu.

Réponds UNIQUEMENT par un objet JSON, sans texte autour :
{"avis": "CONVENTION" | "HORS_SUJET" | "INCERTAIN", "motif": "une phrase courte"}

- "CONVENTION" : tu es confiant qu'il s'agit d'une convention de jonglerie.
- "HORS_SUJET" : tu es confiant que ce n'en est pas une.
- "INCERTAIN" : le titre et les informations ne permettent pas de trancher. UTILISE-LE plutôt que de deviner — un humain relira.

Le "motif" dit en une phrase ce qui t'a décidé, dans la langue française.`

/** Ce qu'un candidat offre au modèle pour juger. */
export interface CandidatAClasser {
  url: string
  titre: string
  pays?: string | null
  lieu?: string | null
  debut?: Date | string | null
  jours?: number | null
}

/** Ce que le modèle a répondu, une fois validé. */
export interface ResultatClassement {
  avis: AvisIa
  motif: string
}

/**
 * Soumet UN candidat au modèle.
 *
 * Un appel par événement, et c'est un choix : un prompt groupé diviserait le coût, mais le modèle
 * peut rendre moins de lignes qu'attendu ou les réordonner. Il faudrait alors apparier sur un
 * identifiant renvoyé par le modèle — jamais sur la position —, et un décalage non détecté
 * attribuerait le verdict d'un événement à un autre, de façon parfaitement plausible.
 *
 * Rend `null` quand la réponse est illisible ou que l'avis sort de l'énumération. **On n'écrit
 * alors rien** : laisser `avisIa` à `NULL` dit « pas encore classé », ce qui est vrai, là où
 * retomber sur une valeur par défaut inventerait un avis que le modèle n'a pas donné.
 */
export async function classerUnCandidat(
  candidat: CandidatAClasser,
  config: ConfigAppelTexte
): Promise<ResultatClassement | null> {
  const details = [
    `Titre : ${candidat.titre}`,
    candidat.pays ? `Pays : ${candidat.pays}` : null,
    candidat.lieu ? `Lieu : ${candidat.lieu}` : null,
    candidat.debut ? `Début : ${new Date(candidat.debut).toISOString().slice(0, 10)}` : null,
    candidat.jours ? `Durée : ${candidat.jours} jour(s)` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const reponse = await demanderAuModele(PROMPT_SYSTEME, `${details}\n\nJSON :`, config)
  const lu = extraireJson<{ avis?: string; motif?: string }>(reponse)

  if (!lu?.avis) return null
  const avis = String(lu.avis).toUpperCase() as AvisIa
  if (!AVIS_VALIDES.includes(avis)) return null

  return {
    avis,
    // Un motif absent n'invalide pas l'avis : on garde l'avis et on le dit, plutôt que de jeter
    // une classification correcte pour une phrase manquante.
    motif: typeof lu.motif === 'string' && lu.motif.trim() ? lu.motif.trim().slice(0, 500) : '—',
  }
}

/** Ce qu'un balayage de classification a produit, pour le dire à l'écran. */
export interface BilanClassement {
  /** Candidats soumis au modèle. */
  soumis: number
  /** Avis obtenus et rangés. */
  classes: number
  /** Réponses illisibles ou hors énumération : rien n'a été écrit pour eux. */
  illisibles: number
  /** Appels en échec (modèle injoignable, clé absente…), avec le premier message rencontré. */
  echecs: number
  premiereErreur: string | null
  /** Ce que le modèle a répondu, par avis. */
  parAvis: Record<AvisIa, number>
}

/**
 * Classe les candidats que le modèle n'a pas encore vus.
 *
 * ⚠️ Ne prend QUE `verdict = A_EXAMINER` et `avisIa IS NULL` :
 * - un candidat déjà tranché par un humain n'a aucun besoin d'un avis, et le soumettre serait
 *   payer pour une information dont personne ne se servira ;
 * - `avisIa IS NULL` est ce qui permet de reprendre où le balayage précédent s'est arrêté, sans
 *   refacturer ce qui est déjà classé.
 *
 * `limite` borne le nombre d'appels d'un seul geste. Avec un appel par événement, une liste de
 * plusieurs centaines ne peut pas être traitée en une requête : l'opérateur relance, et chaque
 * clic a un coût et une durée prévisibles.
 *
 * 📍 Un échec sur un candidat n'interrompt PAS le balayage, et il est COMPTÉ. Sans cela, un modèle
 * momentanément injoignable rendrait « 0 classé » — ce qui se lit « il n'y avait rien à faire »,
 * et c'est faux.
 */
export async function classerLesCandidats(
  limite: number,
  config: ConfigAppelTexte
): Promise<BilanClassement> {
  const aClasser = await prisma.candidatEvenement.findMany({
    where: { verdict: 'A_EXAMINER', avisIa: null },
    // Les plus proches d'abord : ce sont ceux sur lesquels une décision est urgente.
    orderBy: [{ debut: 'asc' }, { id: 'asc' }],
    take: limite,
    select: { url: true, titre: true, pays: true, lieu: true, debut: true, jours: true },
  })

  const bilan: BilanClassement = {
    soumis: aClasser.length,
    classes: 0,
    illisibles: 0,
    echecs: 0,
    premiereErreur: null,
    parAvis: { CONVENTION: 0, HORS_SUJET: 0, INCERTAIN: 0 },
  }

  for (const candidat of aClasser) {
    try {
      const resultat = await classerUnCandidat(candidat, config)

      if (!resultat) {
        bilan.illisibles++
        continue
      }

      await prisma.candidatEvenement.update({
        where: { url: candidat.url },
        // ⚠️ `verdict` n'est PAS dans cet objet, et c'est là que l'invariant se joue. C'est la
        // seule ligne de ce module qu'il ne faut pas « simplifier ».
        data: { avisIa: resultat.avis, avisIaLe: new Date(), motifIa: resultat.motif },
      })

      bilan.classes++
      bilan.parAvis[resultat.avis]++
    } catch (erreur) {
      bilan.echecs++
      if (!bilan.premiereErreur) {
        bilan.premiereErreur = erreur instanceof Error ? erreur.message : 'erreur inconnue'
      }
      console.error(`[VEILLE-IA] ${candidat.url} non classé :`, erreur)
    }
  }

  return bilan
}
