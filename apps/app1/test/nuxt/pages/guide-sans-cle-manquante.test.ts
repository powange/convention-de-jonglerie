import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'

import GuideAutres from '../../../app/pages/guide/organizer/others.vue'
import GuideUtilisateur from '../../../app/pages/guide/user.vue'

/**
 * Le guide ne doit pas afficher le CHEMIN d'une clé absente — garde posée avec le constat B3.
 *
 * ## ⚠️⚠️ POURQUOI CE TEST EXISTE, et ce qu'il attrape que rien d'autre ne voit
 *
 * Ces pages n'emploient pas vue-i18n : elles portent un objet `messages` français et un `t()` fait
 * main qui, **faute de clé, rend le chemin demandé**. Une clé renommée d'un côté et pas de l'autre
 * n'allume donc rien — ni erreur, ni avertissement, ni test rouge : l'écran affiche
 * `sections.workshops.places` au milieu d'une phrase, et il faut l'avoir sous les yeux pour le
 * voir.
 *
 * Ce lot renomme précisément trois clés et en ajoute trois, parce que le guide décrivait des
 * fonctions **qui n'existent pas** (niveau, matériel, animateur, inscription aux ateliers). C'est
 * exactement le geste qui produit ce défaut.
 *
 * 📍 La garde ne vérifie PAS le contenu des phrases — c'est le propre d'un texte d'évoluer. Elle
 * vérifie qu'aucune n'est remplacée par son adresse.
 */
const CHEMIN_NON_RESOLU = /sections\.[a-z]/i

let monte: { unmount: () => void } | null = null
afterEach(() => {
  monte?.unmount()
  monte = null
})

const rendre = async (page: unknown) => {
  const wrapper = await mountSuspended(page as never)
  monte = wrapper
  return wrapper.text()
}

describe('guide : aucune clé manquante', () => {
  it('⚠️ LE GUIDE ORGANISATEUR N’AFFICHE AUCUN CHEMIN DE CLÉ', async () => {
    const texte = await rendre(GuideAutres)

    const trouve = texte.match(CHEMIN_NON_RESOLU)
    expect(
      trouve?.[0] ?? null,
      `Le guide affiche le chemin d'une clé au lieu de son texte : la clé a été renommée dans ` +
        `\`messages\` ou dans le gabarit, mais pas des deux côtés. \`t()\` rend le chemin sans lever.`
    ).toBeNull()

    // Le repère qui empêche un faux vert : une page qui ne rendrait RIEN passerait l'assertion.
    expect(texte).toContain('Workshops')
    expect(texte).toContain('Objets trouvés')
  })

  it('⚠️ LE GUIDE UTILISATEUR NON PLUS', async () => {
    const texte = await rendre(GuideUtilisateur)

    expect(texte.match(CHEMIN_NON_RESOLU)?.[0] ?? null).toBeNull()
    expect(texte).toContain('Workshops')
  })
})
