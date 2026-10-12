import fs from 'node:fs'
import path from 'node:path'

import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'

const compte = vi.hoisted(() => ({ avecMotDePasse: true }))

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 1, pseudo: 'camille', email: 'camille@exemple.test' },
    logout: () => {},
  }),
}))

registerEndpoint('/api/profile/has-password', () => ({
  data: { hasPassword: compte.avecMotDePasse },
}))

import PageSecurite from '../../../app/pages/profile/securite.vue'

/**
 * L'écran Sécurité emploie les règles de mot de passe PARTAGÉES — constat F2 de l'auth.
 *
 * ## Le défaut
 *
 * `regles-mot-de-passe.ts` a été écrit pour que « le serveur comme l'interface » dépendent de la
 * même liste, et `register`, `login`, l'invitation et `reset-password` l'emploient avec
 * `AuthPasswordRequirements`. Cet écran-ci gardait sa copie : trois règles écrites en dur, deux
 * clés d'erreur à lui pour des libellés identiques, et **aucune liste d'exigences ni barre de
 * force** sous le champ — on découvrait la règle manquante en soumettant.
 *
 * Le jour où une règle change, cet écran acceptait ou refusait autre chose que le serveur. C'est
 * la divergence que le module existe pour empêcher, et elle ne se voit pas : les deux copies
 * disaient exactement la même chose, en français, au moment de la lecture.
 *
 * ## ⚠️ Ce que chaque moitié prouve
 *
 * Le MONTAGE prouve que les exigences s'affichent réellement sous le champ — qu'une lecture du
 * code ne dirait pas, le composant venant d'un autre layer et son rendu étant conditionné à la
 * saisie.
 *
 * La garde de SOURCE prouve l'absence de la copie : un écran peut parfaitement afficher la liste
 * partagée **et** valider avec ses propres règles. C'est même précisément la forme que prendrait
 * une régression ici.
 */
/*
 * La puce d'une règle non satisfaite, telle que Nuxt Icon la REND : `i-heroicons:minus-circle`,
 * avec un deux-points.
 *
 * 📍 Écrite `i-heroicons-minus-circle` — la forme du code source, avec un tiret —, l'assertion
 * échouait sur un correctif qui fonctionne. On vise l'icône et non le libellé : les textes
 * dépendent de la langue de l'environnement de test, qui est l'anglais.
 */
const PUCE_DE_REGLE = 'i-heroicons:minus-circle'

let monte: { unmount: () => void; html: () => string } | null = null
afterEach(() => {
  monte?.unmount()
  monte = null
  compte.avecMotDePasse = true
})

describe('profil / sécurité — les exigences de mot de passe s’affichent', () => {
  it('les exigences apparaissent dès qu’un mot de passe est saisi, et pas avant', async () => {
    monte = (await mountSuspended(PageSecurite)) as never

    /*
     * ⚠️ LE RELEVÉ « AVANT » N'EST PAS DÉCORATIF. Sans lui, un composant qui ne rendrait JAMAIS
     * rien ferait passer ce cas pour la mauvaise raison — et c'est précisément ce qu'on vérifie :
     * qu'il s'affiche. Le composant partagé porte un `v-if="password"`, donc l'absence avant la
     * saisie et la présence après forment ensemble la preuve.
     */
    expect(monte!.html()).not.toContain(PUCE_DE_REGLE)

    /*
     * ⚠️ PAR IDENTITÉ, ET NON PAR POSITION. Cet écran porte TROIS champs de mot de passe — actuel,
     * nouveau, confirmation — et `find('input[type="password"]')` rendait le PREMIER : le mot de
     * passe actuel, qui ne nourrit pas le composant. L'assertion échouait donc sur un correctif
     * qui fonctionne. `UFormField name="newPassword"` pose l'attribut `name` sur l'input, qui est
     * le seul repère stable ici.
     */
    const champ = (monte as any).find('input[name="newPassword"]')
    expect(champ.exists(), 'le champ du nouveau mot de passe').toBe(true)
    await champ.setValue('a')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(monte!.html()).toContain(PUCE_DE_REGLE)
  })
})

const RACINE = path.resolve(__dirname, '../../../../..')
const PAGE = 'apps/app1/app/pages/profile/securite.vue'
const lire = (relatif: string) => fs.readFileSync(path.resolve(RACINE, relatif), 'utf8')

describe('profil / sécurité — plus de copie locale des règles', () => {
  it('le schéma vient du module partagé', () => {
    const code = lire(PAGE)
    expect(code).toContain("import { schemaMotDePasse } from '~~/shared/utils/regles-mot-de-passe'")
    expect(code).toContain('newPassword: schemaMotDePasse(t)')
  })

  it('les expressions régulières de mot de passe ont disparu', () => {
    // 📍 LA SIGNATURE DU DÉFAUT. Un écran peut afficher la liste partagée et continuer de valider
    // avec ses propres règles : c'est l'absence de ces deux motifs qui l'exclut.
    const code = lire(PAGE)
    expect(code).not.toContain('(?=.*[A-Z])')
    expect(code).not.toContain('(?=.*\\d)')
  })

  it('les deux clés recopiées ont disparu des treize langues', () => {
    // Elles ne sont pas nommées en clair dans la page : `check-i18n` cherche les clés dans le
    // texte des fichiers, commentaires compris, et les citer les ferait compter comme employées.
    const racines = fs.readdirSync(path.resolve(RACINE, 'apps/app1/i18n/locales'))
    expect(racines.length).toBeGreaterThan(12)
    for (const langue of racines) {
      const profil = JSON.parse(lire(`apps/app1/i18n/locales/${langue}/profil.json`)).profile
      for (const cle of ['password_' + 'uppercase_required', 'password_' + 'digit_required']) {
        expect(profil[cle], `${langue}.profile.${cle}`).toBeUndefined()
      }
    }
  })

  it('le module partagé porte bien les trois règles, avec les clés du domaine des erreurs', () => {
    // Sans ce cas, le précédent serait satisfait par un module vide : les règles auraient
    // simplement disparu des deux côtés.
    const module = lire('apps/app1/shared/utils/regles-mot-de-passe.ts')
    const cles = module.match(/cleErreur: 'errors\.[a-z_]+'/g) ?? []
    expect(cles).toHaveLength(3)
  })
})
