import { describe, expect, it } from 'vitest'

import { estUnLienHttp } from '../../../app/utils/lien-externe'

/**
 * Ce qu'un bouton « ouvrir dans un nouvel onglet » accepte de suivre.
 *
 * La règle existait dans le formulaire d'édition, pour valider la saisie. Elle sert désormais
 * aussi à décider si le bouton s'active — d'où le partage, et d'où ces tests.
 */
describe('estUnLienHttp', () => {
  it('accepte http et https', () => {
    expect(estUnLienHttp('https://www.exemple.org')).toBe(true)
    expect(estUnLienHttp('http://exemple.org/billetterie?a=1')).toBe(true)
  })

  it('REFUSE les protocoles que `new URL` avale pourtant', () => {
    // Le point qui justifie la vérification du protocole : ces trois-là construisent une `URL`
    // parfaitement valide. Un bouton qui ouvre une adresse saisie par un tiers n'a aucune raison
    // de les suivre.
    expect(estUnLienHttp('javascript:alert(1)')).toBe(false)
    expect(estUnLienHttp('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(estUnLienHttp('file:///etc/passwd')).toBe(false)
  })

  it('refuse une adresse SANS protocole', () => {
    // Fréquent à la saisie : on colle « www.exemple.org ». Le champ le refusera aussi, et le
    // bouton doit rester éteint plutôt que d'ouvrir une page introuvable.
    expect(estUnLienHttp('www.exemple.org')).toBe(false)
    expect(estUnLienHttp('exemple.org')).toBe(false)
  })

  it('refuse le vide sous toutes ses formes', () => {
    expect(estUnLienHttp('')).toBe(false)
    expect(estUnLienHttp('   ')).toBe(false)
    expect(estUnLienHttp(null)).toBe(false)
    expect(estUnLienHttp(undefined)).toBe(false)
  })

  it('ignore les espaces autour', () => {
    // Le champ les rogne à la sortie, pas pendant la frappe : le bouton doit s'activer dès que
    // l'adresse est bonne, sans attendre que l'on quitte le champ.
    expect(estUnLienHttp('  https://exemple.org  ')).toBe(true)
  })

  it('refuse un texte qui ressemble à une adresse sans en être une', () => {
    expect(estUnLienHttp('https://')).toBe(false)
    expect(estUnLienHttp('trois mots au hasard')).toBe(false)
  })
})
