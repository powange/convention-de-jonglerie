import { readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { TACHES_PLANIFIEES } from '../../../server/utils/scheduled-tasks'

/**
 * Le catalogue des tâches planifiées doit décrire exactement les tâches qui existent.
 *
 * Trois listes se maintenaient à la main — les fichiers de `server/tasks/`, la liste affichée
 * dans l'administration et la liste blanche d'exécution — et elles ont divergé en silence :
 * `cleanup-empty-conversations` s'affichait sans pouvoir être lancée (400 « Tâche invalide »
 * relevé dans les logs de production), et `task-deadlines-reminders` n'apparaissait nulle part
 * alors qu'elle tournait tous les jours.
 *
 * Les deux points d'API lisent désormais le même catalogue. Ce test protège le dernier écart
 * possible : une tâche ajoutée sur le disque et oubliée dans le catalogue, ou l'inverse.
 */
const RACINES = [
  join(__dirname, '../../../server/tasks'),
  join(__dirname, '../../../../../layers/volunteers/server/tasks'),
]

/** Les tâches réellement définies, application et layers confondus. */
function tachesSurLeDisque(): string[] {
  const noms: string[] = []
  for (const racine of RACINES) {
    let fichiers: string[]
    try {
      fichiers = readdirSync(racine)
    } catch {
      // Un layer peut ne pas avoir de dossier `tasks` : ce n'est pas une erreur.
      continue
    }
    for (const fichier of fichiers) {
      if (fichier.endsWith('.ts')) noms.push(fichier.replace(/\.ts$/, ''))
    }
  }
  return noms.sort()
}

describe('TACHES_PLANIFIEES', () => {
  it('décrit toutes les tâches définies, et rien d’autre', () => {
    const surLeDisque = tachesSurLeDisque()
    const cataloguees = TACHES_PLANIFIEES.map((t) => t.name).sort()

    expect(surLeDisque.length, 'aucune tâche trouvée : les chemins ont dû changer').toBeGreaterThan(
      0
    )

    const absentesDuCatalogue = surLeDisque.filter((n) => !cataloguees.includes(n))
    const catalogueesSansFichier = cataloguees.filter((n) => !surLeDisque.includes(n))

    expect(
      absentesDuCatalogue,
      'tâches définies mais absentes du catalogue : invisibles dans l’administration et impossibles à lancer'
    ).toEqual([])
    expect(
      catalogueesSansFichier,
      'tâches cataloguées sans fichier : le bouton « exécuter » échouerait'
    ).toEqual([])
  })

  it('donne à chaque tâche de quoi être comprise et planifiée', () => {
    for (const tache of TACHES_PLANIFIEES) {
      expect(tache.description.length, `description vide pour ${tache.name}`).toBeGreaterThan(10)
      // Cinq champs : minute, heure, jour, mois, jour de semaine.
      expect(
        tache.cronExpression.trim().split(/\s+/),
        `cron invalide pour ${tache.name}`
      ).toHaveLength(5)
    }
  })

  it('ne déclare pas deux fois la même tâche', () => {
    const noms = TACHES_PLANIFIEES.map((t) => t.name)
    expect(new Set(noms).size).toBe(noms.length)
  })
})
