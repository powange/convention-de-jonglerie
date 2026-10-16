import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * La lecture des habilitations ne se refait pas à chaque artiste scanné.
 *
 * ## Le défaut
 *
 * `validate-entry.post.ts` lisait `prisma.edition.findUnique({ where: { id: editionId } })`
 * **à l'intérieur** de la boucle sur `body.participantIds`. Or `editionId` est le paramètre de
 * route : la requête ne variait pas d'un tour à l'autre, et relisait la même ligne — avec ses
 * trois jointures imbriquées — autant de fois qu'il y avait d'artistes.
 *
 * Scanner cinq artistes ensemble faisait donc cinq fois la même requête, sur **le chemin le plus
 * sensible à la latence du dépôt** : le guichet, à l'entrée d'une convention.
 *
 * ## 📍 CE QUE LA MESURE A APPRIS, ET QUI VAUT PLUS QUE CE CORRECTIF
 *
 * Le relevé annonçait « 63 boucles avec un appel Prisma ». Mesuré : **33**, et surtout, une
 * boucle sur un appel Prisma n'est PAS un défaut en soi — ici les boucles parcourent
 * `body.participantIds`, c'est-à-dire ce que l'opérateur a sélectionné, pas un jeu de données qui
 * grandit.
 *
 * La vraie classe de défaut est plus étroite : **une requête INVARIANTE dans la boucle**. Après
 * vérification de chaque candidate, il n'en restait qu'une dans tout le dépôt — celle-ci. Les
 * autres variaient par indirection (`option` dérivé de `optionField`, `dbOptionId` de
 * `haOptionId`), ce qu'une recherche du nom littéral de la variable ne voit pas.
 *
 * ⚠️ Mon premier détecteur rendait **zéro**, parce que `for (const x of …)` était attrapé par
 * l'alternative `for (` avant celle qui capture la variable : toutes les boucles étaient
 * silencieusement ignorées. Un faux zéro aurait fait conclure « rien à faire ».
 */
const SOURCE = join(
  import.meta.dirname,
  '../../../server/api/editions/[id]/ticketing/validate-entry.post.ts'
)

const code = () => readFileSync(SOURCE, 'utf8')

describe('guichet — la lecture des habilitations est hors de la boucle', () => {
  it('⚠️ LA REQUÊTE PRÉCÈDE LA BOUCLE SUR LES PARTICIPANTS', () => {
    const src = code()
    const requete = src.indexOf('const habilitations = await prisma.edition.findUnique')
    const boucle = src.indexOf('for (const artistId of body.participantIds)')

    expect(requete, 'la lecture des habilitations a disparu').toBeGreaterThan(-1)
    expect(boucle, 'la boucle sur les artistes a disparu').toBeGreaterThan(-1)
    expect(
      requete,
      'la requête est retournée DANS la boucle : elle se refera à chaque artiste scanné'
    ).toBeLessThan(boucle)
  })

  it('elle est lue UNE SEULE FOIS', () => {
    /*
     * Le témoin du précédent : on peut très bien sortir la requête ET en laisser une copie dans
     * la boucle, ce qui ne corrigerait rien tout en donnant l'apparence du correctif.
     */
    const occurrences =
      code().match(/const habilitations = await prisma\.edition\.findUnique/g) ?? []

    expect(occurrences.length, 'la requête est écrite plus d’une fois').toBe(1)
  })

  it('le balayage lit bien le fichier — il ne conclut pas sur le vide', () => {
    expect(code().length, 'source vide ou introuvable').toBeGreaterThan(15000)
  })
})
