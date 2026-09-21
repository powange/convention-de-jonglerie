import { describe, expect, it } from 'vitest'

import {
  entetesDesOrganisateurs,
  ligneDUnOrganisateur,
  organisateursEnCsv,
  type ColonnesOrganisateurs,
} from '../../../app/utils/export-organisateurs'
import { BOM_UTF8 } from '../../../shared/utils/csv'

/**
 * L'export CSV des organisateurs.
 *
 * Ce qui se joue : **ce qu'on exporte doit être ce qu'on voit**. Les deux façons de se tromper
 * coûtent, et aucune ne se remarque en relisant le code.
 *
 * Exporter PLUS que l'écran livre des colonnes que le lecteur n'était pas censé voir — le
 * courriel et le téléphone sont masqués à qui atteint cette liste par la billetterie.
 * Exporter MOINS se découvre au tableur, une fois le fichier envoyé.
 */

// Un traducteur de test : il rend la clé, ce qui rend les attentes lisibles et indépendantes
// des libellés réels.
const t = (cle: string) => cle

const TOUTES: ColonnesOrganisateurs = { contact: true, statut: true, repas: true }
const MINIMALES: ColonnesOrganisateurs = { contact: false, statut: false, repas: false }

const alice = {
  title: 'Trésorière',
  entryValidated: true,
  roles: ['manageTicketing', 'manageMeals'],
  meals: { accepted: 3, total: 5 },
  user: { prenom: 'Alice', nom: 'Martin', email: 'alice@exemple.fr', phone: '+33612345678' },
}

describe('entetesDesOrganisateurs', () => {
  it('porte les colonnes conditionnelles quand elles sont affichées', () => {
    expect(entetesDesOrganisateurs(TOUTES, t)).toEqual([
      'gestion.organizers.organizer',
      'gestion.organizers.title_column',
      'common.email',
      'common.phone',
      'gestion.organizers.status',
      'gestion.organizers.roles_column',
      'common.meals_short',
    ])
  })

  it('les RETIRE quand l’écran ne les affiche pas', () => {
    expect(entetesDesOrganisateurs(MINIMALES, t)).toEqual([
      'gestion.organizers.organizer',
      'gestion.organizers.title_column',
      'gestion.organizers.roles_column',
    ])
  })

  it('n’exporte pas la colonne des actions', () => {
    // Elle est à l'écran, mais des boutons n'ont rien à faire dans un tableur.
    expect(entetesDesOrganisateurs(TOUTES, t).join()).not.toContain('actions')
  })
})

describe('ligneDUnOrganisateur', () => {
  it('suit l’ordre des en-têtes, colonne pour colonne', () => {
    const entetes = entetesDesOrganisateurs(TOUTES, t)
    const ligne = ligneDUnOrganisateur(alice, TOUTES, t)
    expect(ligne).toHaveLength(entetes.length)
  })

  it('reprend le nom tel que l’écran le compose', () => {
    expect(ligneDUnOrganisateur(alice, TOUTES, t)[0]).toBe('Alice Martin')
  })

  it('NE FUITE PAS le contact quand la colonne est masquée', () => {
    // Le cas qui compte : le serveur masque courriel et téléphone à qui vient de la billetterie.
    const ligne = ligneDUnOrganisateur(alice, MINIMALES, t)
    expect(ligne.join('|')).not.toContain('alice@exemple.fr')
    expect(ligne.join('|')).not.toContain('+33612345678')
  })

  it('traduit le statut d’entrée dans les deux sens', () => {
    expect(ligneDUnOrganisateur(alice, TOUTES, t)[4]).toBe('gestion.organizers.entry_validated')
    expect(ligneDUnOrganisateur({ ...alice, entryValidated: false }, TOUTES, t)[4]).toBe(
      'gestion.organizers.entry_not_validated'
    )
  })

  it('sépare les rôles par un POINT-VIRGULE, pas par une virgule', () => {
    // La virgule est le séparateur du fichier : même échappée, elle rend la cellule pénible à
    // redécouper dans un tableur.
    expect(ligneDUnOrganisateur(alice, TOUTES, t)[5]).toBe(
      'gestion.organizers.role.manageTicketing ; gestion.organizers.role.manageMeals'
    )
  })

  it('rend les repas en « acceptés / total »', () => {
    expect(ligneDUnOrganisateur(alice, TOUTES, t)[6]).toBe('3 / 5')
  })

  it('tient debout sur un organisateur dépouillé', () => {
    // Un titre absent, aucun rôle, pas de repas : rien ne doit rendre « undefined » ni lever.
    const ligne = ligneDUnOrganisateur({ user: { prenom: 'Bob' } }, TOUTES, t)
    expect(ligne[1]).toBe('')
    expect(ligne[5]).toBe('')
    expect(ligne[6]).toBe('0 / 0')
    expect(ligne.join('|')).not.toContain('undefined')
  })
})

describe('organisateursEnCsv', () => {
  it('produit un fichier complet, marque d’ordre des octets comprise', () => {
    const csv = organisateursEnCsv([alice], MINIMALES, t)
    expect(csv.startsWith(BOM_UTF8)).toBe(true)
    expect(csv.split('\r\n')).toHaveLength(2)
  })

  it('échappe ce que le format exige, sans que l’appelant y pense', () => {
    const risque = {
      title: 'Trésorière, adjointe',
      roles: [],
      user: { prenom: '=cmd|/c calc', nom: '' },
    }
    const csv = organisateursEnCsv([risque], MINIMALES, t)
    // La virgule du titre reste dans sa cellule, et le nom cesse d'être une formule.
    expect(csv).toContain('"Trésorière, adjointe"')
    expect(csv).toContain(`"'=cmd|/c calc"`)
  })

  it('rend un fichier d’en-têtes seuls quand il n’y a personne', () => {
    expect(organisateursEnCsv([], MINIMALES, t).split('\r\n')).toHaveLength(1)
  })
})
