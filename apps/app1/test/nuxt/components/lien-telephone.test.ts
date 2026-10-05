import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import LienTelephone from '../../../app/components/ui/LienTelephone.vue'

/**
 * Le numéro qui appelle, mutualisé.
 *
 * ⚠️ POURQUOI UN TEST POUR UNE BALISE. Ce composant est désormais employé sur six écrans, dont la
 * fiche d'un contact d'URGENCE. Un `href` mal formé ne se voit pas à la relecture — le numéro
 * s'affiche normalement, et c'est au moment où l'on tape dessus, souvent dans l'urgence, que rien
 * ne se passe.
 */
describe('UiLienTelephone', () => {
  it('appelle le numéro affiché', async () => {
    const composant = await mountSuspended(LienTelephone, { props: { numero: '06 12 34 56 78' } })

    const lien = composant.find('a')
    expect(lien.attributes('href')).toBe('tel:06 12 34 56 78')
    expect(lien.text()).toBe('06 12 34 56 78')
  })

  it('ne rend aucun lien sans numéro', async () => {
    /*
     * 🔬 Sans ce cas, un `href="tel:"` vide passerait inaperçu : il s'affiche comme un lien
     * ordinaire et ne fait rien au clic.
     */
    const composant = await mountSuspended(LienTelephone, { props: { numero: null } })

    expect(composant.find('a').exists()).toBe(false)
    expect(composant.text()).toBe('')
  })

  it('affiche le texte de remplacement quand il y en a un', async () => {
    // Les tableaux veulent un tiret plutôt qu'une cellule vide, qui se lirait comme une colonne
    // mal alignée.
    const composant = await mountSuspended(LienTelephone, { props: { numero: '', vide: '-' } })

    expect(composant.find('a').exists()).toBe(false)
    expect(composant.text()).toBe('-')
  })
})
