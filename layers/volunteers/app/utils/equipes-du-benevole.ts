/**
 * Le choix des équipes d'un bénévole, tel que la modale de répartition le manipule.
 *
 * Trois règles courtes, sorties du composant parce que ce sont elles qui se trompent : d'où
 * partent les cases cochées, ce que coche ou décoche un clic, et dans quel groupe chaque équipe
 * se range. Les vérifier ici évite de monter une page et ses six appels réseau.
 */

/** Un rattachement tel que le rend `team-assignments` : l'identifiant d'équipe y est à plat. */
interface RattachementBenevole {
  teamId: string
}

/**
 * Les équipes auxquelles le bénévole appartient déjà — celles que la modale doit ouvrir cochées.
 */
export function equipesDuBenevole(
  benevole: { teamAssignments?: RattachementBenevole[] } | null | undefined
): string[] {
  return (benevole?.teamAssignments ?? []).map((rattachement) => rattachement.teamId)
}

/**
 * La sélection après un clic sur une case.
 *
 * Rendue plutôt que mutée : la liaison d'une case passe par `:model-value` et un événement, et
 * non par un `v-model` de tableau — `UCheckbox` attend un booléen, et lui donner la liste
 * cochait toutes les cases d'un coup sans jamais refléter l'état réel.
 */
export function basculerEquipe(selection: string[], teamId: string, coche: boolean): string[] {
  const deja = selection.includes(teamId)
  if (coche && !deja) return [...selection, teamId]
  if (!coche && deja) return selection.filter((id) => id !== teamId)
  return selection
}

/** Un groupe d'équipes présenté dans la modale. */
export interface GroupeEquipes<T> {
  cle: 'preferees' | 'autres'
  libelle: string
  equipes: T[]
}

/**
 * Range les équipes en deux groupes : celles que le bénévole a demandées, puis les autres.
 *
 * Un groupe vide disparaît plutôt que d'afficher un intitulé sans rien dessous. La préférence
 * n'interdit rien — les deux groupes restent cochables —, elle guide seulement le regard.
 */
export function grouperParPreference<T>(
  equipes: T[],
  estPreferee: (equipe: T) => boolean
): Array<GroupeEquipes<T>> {
  return [
    {
      cle: 'preferees' as const,
      libelle: 'pages.volunteers.team_distribution.preferred_teams',
      equipes: equipes.filter(estPreferee),
    },
    {
      cle: 'autres' as const,
      libelle: 'pages.volunteers.team_distribution.other_teams',
      equipes: equipes.filter((equipe) => !estPreferee(equipe)),
    },
  ].filter((groupe) => groupe.equipes.length > 0)
}

/**
 * L'effectif de chaque équipe : bénévoles affectés et organisateurs rattachés, comptés
 * ensemble. Un organisateur occupe une place comme un bénévole — c'est la règle posée pour
 * les créneaux, et elle vaut aussi pour une équipe.
 */
export function effectifParEquipe(
  candidatures: Array<{ teamAssignments?: RattachementBenevole[] }>,
  organisateurs: Array<{ teamIds?: string[] }> = []
): Record<string, number> {
  const effectif: Record<string, number> = {}

  for (const candidature of candidatures) {
    for (const rattachement of candidature.teamAssignments ?? []) {
      effectif[rattachement.teamId] = (effectif[rattachement.teamId] ?? 0) + 1
    }
  }
  for (const organisateur of organisateurs) {
    for (const teamId of organisateur.teamIds ?? []) {
      effectif[teamId] = (effectif[teamId] ?? 0) + 1
    }
  }

  return effectif
}
