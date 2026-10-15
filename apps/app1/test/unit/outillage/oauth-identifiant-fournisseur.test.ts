import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * La liaison OAuth repose sur l'identifiant du fournisseur, pas sur l'adresse — constat `auth A3`.
 *
 * ## Le défaut
 *
 * `google.get.ts` et `facebook.get.ts` ne cherchaient le compte que par `findUnique({ email })`.
 * Or l'adresse change. Un utilisateur qui modifiait la sienne — ici, ou chez son fournisseur —
 * obtenait au bouton suivant un compte **NEUF** : sans ses billets, ses candidatures ni ses
 * conventions. En silence, sans erreur affichée. Le seul recours était la fusion de comptes côté
 * administrateur, c'est-à-dire la réparation à la main de quelque chose qui se produisait déjà.
 *
 * 📍 Les deux identifiants stables étaient DÉJÀ renvoyés et jetés : le scope Google contient
 * `openid` (donc `sub`), et Facebook demande `id` dans ses `fields`. Il n'y avait rien à aller
 * chercher — seulement à l'enregistrer.
 *
 * ## ⚠️ POURQUOI UNE GARDE DE SOURCE, ET CE QU'ELLE NE PROUVE PAS
 *
 * Éprouver ces routes par un montage demanderait de doubler l'échange de jetons, l'appel au
 * profil distant, les cookies d'état de `h3` et l'ouverture de session. Ce dépôt porte déjà
 * plusieurs tests qui, montés de cette façon, sont **sortis verts sur du code mort**.
 *
 * Cette garde vérifie donc la FORME du code, pas son comportement : elle attraperait un retour
 * à la recherche par adresse seule, et c'est le but. **Elle ne prouve pas qu'une connexion
 * Google fonctionne.** Le comportement de la fusion, lui, est éprouvé pour de vrai dans
 * `test/nuxt/server/utils/user-merge-identifiants-fournisseur.test.ts`.
 */
const ROUTES = join(import.meta.dirname, '../../../../../layers/auth/server/routes/auth')

/*
 * ⚠️ LES COMMENTAIRES SONT RETIRÉS, et ce n'est pas une précaution de principe : les commentaires
 * que ce lot a posés dans les deux routes CONTIENNENT les mots `googleId`, `facebookId`, « adresse »
 * et la description du défaut d'avant. Sans ce retrait, la garde se prouverait sur l'explication
 * au lieu du code. Piège déjà payé huit fois dans ce dépôt.
 *
 * Et `readFileSync` et non une lecture tolérante : un chemin faux doit faire ÉCHOUER les cas, pas
 * les rendre verts sur une chaîne vide — d'où le témoin en fin de fichier.
 */
const code = (fichier: string) =>
  readFileSync(join(ROUTES, fichier), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')

const CAS = [
  { fichier: 'google.get.ts', colonne: 'googleId', champ: 'sub' },
  { fichier: 'facebook.get.ts', colonne: 'facebookId', champ: 'id' },
] as const

describe('liaison OAuth par identifiant de fournisseur', () => {
  for (const { fichier, colonne, champ } of CAS) {
    describe(fichier, () => {
      it(`⚠️ CHERCHE PAR ${'`'}${colonne}${'`'} AVANT de chercher par adresse`, () => {
        /*
         * L'ordre est le cœur du correctif, et pas seulement pour le cas nominal : si l'adresse
         * appartient désormais à un AUTRE compte du fournisseur, chercher par identifiant d'abord
         * rend le bon compte, tandis que chercher par adresse d'abord rendrait celui de
         * quelqu'un d'autre.
         */
        const src = code(fichier)
        const parIdentifiant = src.indexOf(`where: { ${colonne}: providerId }`)
        const parAdresse = src.indexOf('where: { email }')

        expect(parIdentifiant, `aucune recherche par ${colonne}`).toBeGreaterThan(-1)
        expect(parAdresse, 'le secours par adresse a disparu').toBeGreaterThan(-1)
        expect(
          parIdentifiant,
          `la recherche par adresse passe avant celle par ${colonne}`
        ).toBeLessThan(parAdresse)
      })

      it(`lit l’identifiant stable du fournisseur (${'`'}${champ}${'`'})`, () => {
        expect(code(fichier)).toContain(`userInfo?.${champ} as string | undefined`)
      })

      it(`enregistre ${'`'}${colonne}${'`'} à la CRÉATION du compte`, () => {
        /*
         * Sans cela, un compte créé aujourd'hui repartirait sans lien et serait exposé au même
         * défaut dès le premier changement d'adresse.
         */
        expect(code(fichier)).toContain(`...(providerId ? { ${colonne}: providerId } : {})`)
      })

      it(`⚠️ RATTRAPE les comptes d’avant, et SEULEMENT sur un champ vide`, () => {
        /*
         * Le rattrapage se fait tout seul : le compte retrouvé par adresse inscrit son
         * identifiant, et la connexion suivante passe par la recherche stable. Aucun script de
         * reprise n'était possible — ces valeurs n'ont jamais été conservées.
         *
         * ⚠️ `=== null` ET NON `!== providerId` : si le compte porte déjà un AUTRE identifiant,
         * l'écraser volerait le lien du premier. Ce cas garde cette nuance, parce qu'elle est
         * invisible à la relecture.
         */
        const src = code(fichier)

        expect(src, 'le rattrapage a disparu').toContain(
          `if (providerId && dbUser.${colonne} === null)`
        )
        expect(src, 'le rattrapage écrase un lien existant').not.toContain(
          `dbUser.${colonne} !== providerId`
        )
      })
    })
  }

  it('⚠️ FACEBOOK RECONNAÎT UN UTILISATEUR MÊME SANS ADRESSE RENVOYÉE', () => {
    /*
     * Propre à ce fournisseur : Facebook peut ne PAS renvoyer d'adresse selon les permissions
     * accordées, et le code refusait alors la connexion d'un utilisateur parfaitement connu. La
     * recherche par identifiant doit donc précéder la garde sur l'adresse.
     *
     * L'adresse ne redevient indispensable que pour CRÉER un compte, faute de savoir en fabriquer
     * un sans elle.
     */
    const src = code('facebook.get.ts')
    const parIdentifiant = src.indexOf('where: { facebookId: providerId }')
    const gardeAdresse = src.indexOf('if (!email)')

    expect(gardeAdresse, 'la garde sur l’adresse a disparu').toBeGreaterThan(-1)
    expect(
      parIdentifiant,
      'la garde sur l’adresse refuse encore un utilisateur déjà connu'
    ).toBeLessThan(gardeAdresse)
  })

  it('le balayage lit bien les deux fichiers — il ne conclut pas sur le vide', () => {
    for (const { fichier } of CAS) {
      expect(code(fichier).length, `${fichier} vide ou introuvable`).toBeGreaterThan(3000)
    }
  })
})
