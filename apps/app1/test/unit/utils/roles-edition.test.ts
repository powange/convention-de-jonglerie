import { describe, expect, it } from 'vitest'

import { EDITION_MODULE_RIGHTS } from '../../../shared/utils/organizer-rights'
import { cleLongue, couleurDuRole, rolesDeLEdition } from '../../../shared/utils/roles-edition'

/**
 * Les modules qu'un organisateur peut réellement gérer sur une édition.
 *
 * Le piège : un droit vient de DEUX sources — la convention, valable sur toutes ses éditions, et
 * l'édition elle-même. Ne lire que la seconde laisserait vide la ligne de quelqu'un qui a tout au
 * niveau convention, ce qui est exactement l'inverse de ce que la colonne doit montrer.
 */
describe('rolesDeLEdition', () => {
  it('retient un droit accordé sur l’édition', () => {
    expect(rolesDeLEdition(null, { canManageMeals: true })).toEqual(['manageMeals'])
  })

  it('retient un droit venu de la CONVENTION', () => {
    // Sans ce cas, un membre permanent de l'équipe apparaîtrait sans aucun rôle.
    expect(rolesDeLEdition({ canManageVolunteers: true }, null)).toEqual(['manageVolunteers'])
  })

  it('ne compte pas deux fois un droit accordé des deux côtés', () => {
    expect(rolesDeLEdition({ canManageArtists: true }, { canManageArtists: true })).toEqual([
      'manageArtists',
    ])
  })

  it('rend les modules dans l’ordre de référence', () => {
    // L'ordre vient de `EDITION_MODULE_RIGHTS`, pas de celui des clés de l'objet : deux lignes du
    // tableau doivent présenter leurs pastilles dans le même ordre.
    const tout = Object.fromEntries(EDITION_MODULE_RIGHTS.map((m) => [cleLongue(m), true]))

    expect(rolesDeLEdition(tout, null)).toEqual([...EDITION_MODULE_RIGHTS])
  })

  it('ne rend rien sans aucun droit', () => {
    expect(rolesDeLEdition(null, null)).toEqual([])
    expect(rolesDeLEdition({}, {})).toEqual([])
  })

  it('ignore un droit explicitement refusé', () => {
    expect(rolesDeLEdition({ canManageMeals: false }, { canManageMeals: false })).toEqual([])
  })

  it('donne TOUS les modules à qui peut tout d’office', () => {
    // L'auteur de la convention et le créateur de l'édition n'ont pas de ligne de droits : leur
    // afficher une colonne vide serait le plus trompeur des affichages.
    expect(rolesDeLEdition(null, null, true)).toEqual([...EDITION_MODULE_RIGHTS])
  })

  it('n’inclut ni « Informations » ni « Supprimer »', () => {
    // Ce sont des droits d'édition, pas des modules : la colonne ne montre que les seconds.
    const tout = Object.fromEntries(EDITION_MODULE_RIGHTS.map((m) => [cleLongue(m), true]))
    const roles = rolesDeLEdition({ ...tout, canEdit: true, canDelete: true } as never, null)

    expect(roles).not.toContain('edit')
    expect(roles).not.toContain('delete')
    expect(roles).toHaveLength(EDITION_MODULE_RIGHTS.length)
  })
})

describe('cleLongue', () => {
  it('traduit une clé courte en clé de schéma', () => {
    expect(cleLongue('manageFAQ')).toBe('canManageFAQ')
    expect(cleLongue('manageVolunteers')).toBe('canManageVolunteers')
  })

  it('couvre TOUS les modules, sans trou', () => {
    // Un module dont la clé longue serait mal formée disparaîtrait silencieusement de la colonne.
    for (const module of EDITION_MODULE_RIGHTS) {
      expect(cleLongue(module)).toBe(`can${module.charAt(0).toUpperCase()}${module.slice(1)}`)
    }
  })
})

/**
 * Une couleur par rôle.
 *
 * Toute l'utilité de la colorisation est de repérer d'un coup d'œil qui partage le même rôle.
 * Deux rôles de même teinte la lui retireraient — sans que rien ne le signale.
 */
describe('couleurs des rôles', () => {
  it('donne une couleur à CHAQUE module, sans trou', () => {
    for (const module of EDITION_MODULE_RIGHTS) {
      expect(couleurDuRole(module)).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('n’attribue JAMAIS la même couleur à deux rôles', () => {
    const couleurs = EDITION_MODULE_RIGHTS.map(couleurDuRole)

    expect(new Set(couleurs).size).toBe(EDITION_MODULE_RIGHTS.length)
  })

  it('retombe sur une teinte neutre pour un rôle inconnu', () => {
    // Un module ajouté au schéma sans couleur ne doit pas casser l'affichage.
    expect(couleurDuRole('manageSomethingNew')).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
