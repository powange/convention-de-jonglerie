import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect } from 'vitest'
import { defineComponent } from 'vue'

import JugglingBall from '../../../app/components/ui/JugglingBall.vue'

/**
 * La balle de jonglerie en SVG.
 *
 * ⚠️ LE CAS QUI JUSTIFIE CE FICHIER est celui des IDENTIFIANTS. Le dégradé qui donne son volume à
 * la balle est référencé par `url(#…)`, et le navigateur résout cette référence sur le PREMIER
 * élément portant cet identifiant dans le document. Un `id` figé ferait donc que trois balles
 * partageraient un seul dégradé — et que les suivantes perdraient leur relief, ou disparaîtraient
 * si celle qui le porte venait à être démontée. Rien ne le signalerait : ni erreur, ni avertissement.
 */
describe('UiJugglingBall', () => {
  it('rend un SVG avec ses deux panneaux', async () => {
    const balle = await mountSuspended(JugglingBall, {
      props: { couleurA: '#111111', couleurB: '#222222' },
    })
    const html = balle.html()

    expect(html).toContain('<svg')
    // Les deux couleurs sont appliquées : sans cela la balle serait monochrome, donc une bille.
    expect(html).toContain('#111111')
    expect(html).toContain('#222222')
    // Le panneau central est une lentille, pas un cercle : c'est ce qui en fait une balle à coutures.
    expect(html).toContain('A 26 48 0 0 1')
  })

  it('⚠️ donne un dégradé PROPRE à chaque balle de la MÊME page', async () => {
    /*
     * ⚠️ DEUX BALLES DANS UN SEUL MONTAGE, et non deux montages.
     *
     * `useId` numérote par instance d'application : deux `mountSuspended` en créent deux, et
     * rendent donc le même identifiant — ce qui ferait croire au défaut alors que le composant est
     * correct. Le cas réel est celui de plusieurs balles dans UNE page, et c'est lui qu'il faut
     * reproduire. Mon premier jet se trompait de mesure.
     */
    const deuxBalles = defineComponent({
      components: { JugglingBall },
      template: '<div><JugglingBall /><JugglingBall /></div>',
    })

    const html = (await mountSuspended(deuxBalles)).html()
    const identifiants = [...html.matchAll(/id="(balle-volume-[^"]+)"/g)].map((m) => m[1])

    expect(identifiants).toHaveLength(2)
    expect(identifiants[0]).not.toBe(identifiants[1])
    // Et chacune référence LE SIEN : un identifiant unique ne sert à rien si le `fill` pointe
    // ailleurs.
    for (const identifiant of identifiants) {
      expect(html).toContain(`url(#${identifiant})`)
    }
  })

  it('référence le dégradé qu’elle déclare, et pas un autre', async () => {
    // Un identifiant unique ne sert à rien si le `fill` pointe ailleurs : c'est la paire qui compte.
    const html = (await mountSuspended(JugglingBall)).html()
    const declare = html.match(/id="(balle-volume-[^"]+)"/)?.[1]
    expect(html).toContain(`url(#${declare})`)
  })

  it('est décorative par défaut, annonçable sur demande', async () => {
    /*
     * Une balle d'easter egg n'a rien à dire à un lecteur d'écran : `aria-hidden` par défaut. Mais
     * le jour où elle porte un sens, le libellé doit suffire à la rendre annonçable — sans quoi on
     * la dupliquerait avec un `<span class="sr-only">` à côté.
     */
    const muette = await mountSuspended(JugglingBall)
    expect(muette.html()).toContain('aria-hidden="true"')
    expect(muette.html()).not.toContain('role="img"')

    const parlante = await mountSuspended(JugglingBall, {
      props: { libelle: 'Balle de jonglerie' },
    })
    expect(parlante.html()).toContain('role="img"')
    expect(parlante.html()).toContain('aria-label="Balle de jonglerie"')
    expect(parlante.html()).not.toContain('aria-hidden')
  })

  it('suit la taille demandée', async () => {
    const balle = await mountSuspended(JugglingBall, { props: { taille: 24 } })
    expect(balle.html()).toContain('width="24"')
    // Le `viewBox` ne bouge pas : c'est lui qui garde les proportions quelle que soit la taille.
    expect(balle.html()).toContain('viewBox="0 0 100 100"')
  })
})
