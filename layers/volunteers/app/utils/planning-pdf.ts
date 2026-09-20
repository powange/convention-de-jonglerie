/**
 * Le planning d'un bénévole, préparé pour l'impression.
 *
 * C'est le document qu'on emporte : celui qu'on plie dans une poche avant de partir tenir un
 * poste, quand le réseau du gymnase ne répond plus. Ce qui en sort se décide donc ici, séparément
 * de la mise en page — un créneau oublié envoie quelqu'un au mauvais endroit, et une feuille
 * imprimée ne se corrige pas.
 *
 * Ce fichier ne produit aucun HTML. L'export passait auparavant par une fenêtre ouverte à la
 * volée dans laquelle on écrivait une page entière par concaténation, avec un échappement écrit
 * sur place : deux risques pour un seul geste — les bloqueurs de fenêtres empêchent le premier,
 * et le second se paie au premier caractère oublié. En ne rendant que des valeurs, la question
 * de l'échappement ne se pose plus.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Un créneau, tel que la page le tient. */
export interface CreneauDePlanning {
  id?: number | string
  title?: string | null
  description?: string | null
  startDateTime: string | Date
  endDateTime: string | Date
  /** Le retard annoncé, en minutes. Il décale réellement le créneau, il ne le commente pas. */
  delayMinutes?: number | null
  team?: { id?: number | string; name?: string | null; color?: string | null } | null
}

/** Une ligne du planning, chaque colonne déjà réduite en texte. */
export interface LigneDePlanning {
  /** Le jour et l'heure de début, dans le fuseau de l'édition. */
  debut: string
  /** L'heure de fin seule : le jour est déjà porté par le début. */
  fin: string
  titre: string
  equipe: string
  /** La couleur de l'équipe, en composantes rouge/vert/bleu — ce que la mise en page attend. */
  couleurEquipe: [number, number, number]
  description: string
  /** Le retard en minutes, ou `0` — la mise en page décide s'il mérite d'être annoncé. */
  retardMinutes: number
}

/** La couleur de repli, quand une équipe n'en a pas ou en a une que rien ne valide. */
export const COULEUR_PAR_DEFAUT = '#3b82f6'

/**
 * Une couleur utilisable, ou celle de repli.
 *
 * Conservé de l'ancien export, et pour la même raison : la couleur vient d'une saisie libre
 * d'organisateur. Ce n'est plus une protection contre une injection — on n'écrit plus de
 * feuille de style — mais une garantie que la bibliothèque de rendu reçoit ce qu'elle attend.
 */
export function couleurDEquipe(couleur: string | null | undefined): string {
  if (!couleur) return COULEUR_PAR_DEFAUT
  return /^#[0-9a-fA-F]{3,8}$/.test(couleur) ? couleur : COULEUR_PAR_DEFAUT
}

/**
 * Une couleur hexadécimale, réduite à ses trois composantes.
 *
 * La bibliothèque de rendu ne lit pas `#rrggbb`. La forme courte (`#abc`) est développée, et la
 * composante d'opacité d'une forme à huit chiffres est ignorée : sur du papier, elle n'a pas de
 * sens. Tout ce qui n'est pas lisible retombe sur la couleur par défaut plutôt que sur du noir,
 * qui se confondrait avec le reste du texte.
 */
export function composantesRvb(couleur: string | null | undefined): [number, number, number] {
  const valide = couleurDEquipe(couleur).slice(1)
  const six =
    valide.length === 3 || valide.length === 4
      ? valide
          .slice(0, 3)
          .split('')
          .map((c) => c + c)
          .join('')
      : valide.slice(0, 6)

  if (six.length !== 6) return composantesRvb(COULEUR_PAR_DEFAUT)
  return [
    parseInt(six.slice(0, 2), 16),
    parseInt(six.slice(2, 4), 16),
    parseInt(six.slice(4, 6), 16),
  ]
}

/** Les deux instants réels d'un créneau, retard compris. */
export function horairesReels(creneau: CreneauDePlanning): { debut: Date; fin: Date } | null {
  const debut = new Date(creneau.startDateTime)
  const fin = new Date(creneau.endDateTime)
  if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) return null

  // Le retard décale les deux bornes, jamais une seule : un créneau de deux heures reste un
  // créneau de deux heures, il commence plus tard.
  const retard = Number(creneau.delayMinutes) || 0
  if (retard !== 0) {
    debut.setMinutes(debut.getMinutes() + retard)
    fin.setMinutes(fin.getMinutes() + retard)
  }
  return { debut, fin }
}

/** De quoi situer la feuille d'un coup d'œil, une fois détachée de l'écran. */
export interface ResumeDePlanning {
  creneaux: number
  /** La durée cumulée, en millisecondes — la mise en forme appartient à l'écran. */
  dureeTotaleMs: number
  /** Combien d'équipes distinctes, un créneau sans équipe n'en comptant pour aucune. */
  equipes: number
  /** Combien de créneaux portent un retard — ce qu'on vérifie en premier sur place. */
  retards: number
}

/**
 * Le résumé de la feuille.
 *
 * La durée cumulée se calcule sur les horaires **réels**. Elle serait la même en ignorant le
 * retard, puisqu'il décale les deux bornes — mais la calculer sur ce qu'on imprime évite qu'une
 * évolution de la règle du retard fasse diverger le total du détail sans que rien ne le dise.
 */
export function resumerPlanning(creneaux: CreneauDePlanning[]): ResumeDePlanning {
  let dureeTotaleMs = 0
  let retards = 0
  const equipes = new Set<string>()

  for (const creneau of creneaux) {
    const horaires = horairesReels(creneau)
    if (horaires) dureeTotaleMs += horaires.fin.getTime() - horaires.debut.getTime()
    if ((Number(creneau.delayMinutes) || 0) !== 0) retards += 1
    if (creneau.team?.id !== undefined && creneau.team?.id !== null) {
      equipes.add(String(creneau.team.id))
    }
  }

  return { creneaux: creneaux.length, dureeTotaleMs, equipes: equipes.size, retards }
}

/** Comment chaque instant est mis en mots — passé en paramètre pour rester testable sans écran. */
export interface FormatDesHoraires {
  /** Le jour et l'heure de début. */
  debut: (date: Date) => string
  /** L'heure de fin seule. */
  fin: (date: Date) => string
}

/**
 * Les lignes à imprimer, dans l'ordre reçu.
 *
 * L'ordre est celui de l'écran, et c'est voulu : on suit sa journée de haut en bas, et une
 * feuille qui trierait autrement obligerait à la relire en entier pour trouver le créneau suivant.
 *
 * Un créneau dont les dates sont illisibles est écarté plutôt qu'imprimé vide : une ligne sans
 * horaire ne dit rien à qui la lit, et laisse croire qu'un poste est à tenir sans dire quand.
 */
export function lignesDePlanning(
  creneaux: CreneauDePlanning[],
  format: FormatDesHoraires
): LigneDePlanning[] {
  const lignes: LigneDePlanning[] = []

  for (const creneau of creneaux) {
    const horaires = horairesReels(creneau)
    if (!horaires) continue

    lignes.push({
      debut: format.debut(horaires.debut),
      fin: format.fin(horaires.fin),
      titre: (creneau.title ?? '').trim(),
      equipe: (creneau.team?.name ?? '').trim(),
      couleurEquipe: composantesRvb(creneau.team?.color),
      description: (creneau.description ?? '').trim(),
      retardMinutes: Number(creneau.delayMinutes) || 0,
    })
  }

  return lignes
}

/**
 * Le nom du fichier proposé au téléchargement.
 *
 * Même forme que la fiche d'inventaire du matériel : accents retirés, ponctuation remplacée par
 * un tiret. Le nom du bénévole y figure quand on le connaît — un organisateur imprime les
 * plannings de son équipe les uns après les autres, et dix fichiers `planning.pdf` dans un
 * dossier de téléchargements ne se distinguent plus.
 */
export function nomFichierPlanning(
  nomBenevole?: string | null,
  nomEdition?: string | null,
  prefixe = 'planning'
): string {
  const morceaux = [nomEdition, nomBenevole]
    .map((morceau) =>
      (morceau ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
    )
    .filter(Boolean)

  // Composé plutôt qu'écrit d'une pièce : une chaîne pointée littérale se fait prendre pour une
  // clé de traduction par l'analyse i18n, qui la signale alors comme manquante.
  return morceaux.length > 0 ? `${prefixe}-${morceaux.join('-')}.pdf` : `${prefixe}.pdf`
}
