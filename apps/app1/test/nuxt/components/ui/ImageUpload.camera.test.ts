import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ImageUpload from '../../../../app/components/ui/ImageUpload.vue'
import { global } from '../../globales-nitro'

/**
 * Le bouton « Prendre une photo » des envois d'image.
 *
 * Demandé pour les objets trouvés : on photographie l'objet sur place, et passer par la galerie
 * obligeait à sortir de l'application.
 *
 * Ce que ces tests protègent tient en deux points, tous deux invisibles à la relecture :
 *
 * — `capture` vit sur un input SÉPARÉ. Sur la plupart des navigateurs mobiles il remplace le
 *   sélecteur au lieu de s'y ajouter ; le poser sur l'input existant retirerait l'accès à la
 *   galerie, sans que rien ne le signale ici.
 * — Le bouton ne paraît que sur un pointeur grossier. Sur un ordinateur `capture` est ignoré et
 *   il ouvrirait un banal sélecteur de fichiers — une promesse non tenue.
 */

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key,
  locale: { value: 'fr' },
}))

/** Simule un appareil tactile, ou non, pour `useMediaQuery('(pointer: coarse)')`. */
const simulerPointeur = (grossier: boolean) => {
  global.matchMedia = vi.fn((media: string) => ({
    matches: grossier && media.includes('coarse'),
    media,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof global.matchMedia
}

const monter = (props: Record<string, unknown>) =>
  mountSuspended(ImageUpload, {
    props: { endpoint: { type: 'lost-found', id: 1 }, ...props },
  })

describe('ImageUpload — prise de photo', () => {
  beforeEach(() => {
    simulerPointeur(true)
  })

  it("n'ajoute rien tant que la prise de photo n'est pas demandée", async () => {
    const c = await monter({})

    expect(c.find('input[capture]').exists()).toBe(false)
    expect(c.text()).not.toContain('upload.take_photo')
  })

  it('propose la photo sur un appareil tactile', async () => {
    const c = await monter({ allowCamera: true })

    expect(c.text()).toContain('upload.take_photo')
  })

  it('laisse intact le champ qui ouvre la galerie', async () => {
    const c = await monter({ allowCamera: true })

    const entrees = c.findAll('input[type="file"]')
    expect(entrees).toHaveLength(2)

    // Celui d'origine ne porte pas `capture` : sans quoi la galerie deviendrait inaccessible.
    const galerie = entrees.find((e) => !e.attributes('capture'))
    expect(galerie, 'un champ sans capture doit subsister').toBeTruthy()
    expect(galerie!.attributes('accept')).toContain('image/jpeg')

    // Celui de la caméra vise l'objectif arrière et accepte tout format d'image : le filtre réel
    // est `validateFile`, pas cet attribut.
    const camera = entrees.find((e) => e.attributes('capture'))
    expect(camera!.attributes('capture')).toBe('environment')
    expect(camera!.attributes('accept')).toBe('image/*')
  })

  it('ne propose pas la photo sur un pointeur fin', async () => {
    simulerPointeur(false)
    const c = await monter({ allowCamera: true })

    expect(c.text()).not.toContain('upload.take_photo')
  })
})
