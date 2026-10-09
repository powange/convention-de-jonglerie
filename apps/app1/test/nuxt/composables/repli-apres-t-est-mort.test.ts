import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect } from 'vitest'
import { defineComponent, h } from 'vue'

/**
 * `t('cle.absente') || 'repli'` : le repli ne peut JAMAIS servir.
 *
 * ## Pourquoi ce test existe avant le nettoyage
 *
 * Trente-trois écritures de cette forme traînent dans le dépôt, dont six dans des toasts. Elles
 * ont l'air d'une précaution — « si la traduction manque, affiche au moins ceci ». Elles n'en sont
 * pas : **`t()` rend la CLÉ quand elle manque**, jamais une chaîne vide. La clé est une chaîne non
 * vide, donc toujours vraie, donc `||` ne se déclenche pas. Un utilisateur voit
 * « common.saved » et non « Sauvegardé ».
 *
 * ⚠️ Ce test ne décore pas le nettoyage, il le JUSTIFIE. Retirer trente-trois replis sur la foi
 * d'un souvenir serait exactement le genre de nettoyage qui casse ce qu'il prétend simplifier ;
 * si vue-i18n changeait ce comportement, c'est ici qu'on l'apprendrait.
 */
describe('le repli après t() est du code mort', () => {
  const lire = async (cle: string) => {
    let valeur = ''
    await mountSuspended(
      defineComponent({
        setup() {
          const { t } = useI18n()
          valeur = t(cle)
          return () => h('div')
        },
      })
    )
    return valeur
  }

  it('rend la clé elle-même quand la traduction manque', async () => {
    expect(await lire('une.cle.vraiment.absente')).toBe('une.cle.vraiment.absente')
  })

  it('donc la valeur rendue est TOUJOURS vraie, et `||` est inatteignable', async () => {
    const valeur = await lire('une.autre.cle.absente')

    expect(Boolean(valeur)).toBe(true)
    // La démonstration, écrite comme dans le code qu'on nettoie :
    expect(valeur || 'repli jamais atteint').toBe('une.autre.cle.absente')
  })

  it('et une clé PRÉSENTE est traduite, ce qui exclut un faux positif', async () => {
    /*
     * Sans ce cas, les deux assertions ci-dessus passeraient aussi si `t` était cassé et rendait
     * toujours son argument — on « prouverait » alors que le repli est mort pour la mauvaise
     * raison.
     *
     * 📍 On n'affirme pas le LIBELLÉ : le harnais de test monte l'application en anglais, et
     * `common.save` y vaut « Save ». Ce qui compte est qu'une clé présente ne soit pas rendue
     * telle quelle.
     */
    const valeur = await lire('common.save')

    expect(valeur).not.toBe('common.save')
    expect(valeur.length).toBeGreaterThan(0)
  })
})
