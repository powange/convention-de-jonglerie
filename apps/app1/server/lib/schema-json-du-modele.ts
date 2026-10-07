import { z } from 'zod'

/**
 * Le JSON Schema qu'on impose au modèle local, dérivé du schéma d'IMPORT.
 *
 * ## Pourquoi
 *
 * Les appels à LM Studio n'envoyaient aucun `response_format` : la validité du JSON ne tenait qu'à
 * l'obéissance du modèle au prompt. C'est ce qui a produit `"timezone": "EDT"` alors que le prompt
 * exige « Format IANA (ex: Europe/Paris) », exemples compris.
 *
 * Avec un schéma, LM Studio contraint le décodage : le modèle ne peut émettre que des jetons
 * conformes, et un JSON malformé devient mécaniquement impossible — plus de prose autour de
 * l'objet, plus de champ au mauvais type, plus de virgule manquante.
 *
 * ## Dérivé, et non recopié
 *
 * La forme vient du schéma Zod de l'import, le seul qui fasse foi. Recopiée à la main, elle aurait
 * divergé dès le premier champ ajouté — et la divergence se serait lue comme un refus d'import
 * incompréhensible.
 *
 * ## ⚠️ AUCUN CHAMP OBLIGATOIRE, ET C'EST LE POINT DÉLICAT
 *
 * Le schéma d'import EXIGE `city`, `postalCode`, `country`, les dates, l'adresse courriel de la
 * convention. Les transmettre comme obligatoires au modèle le forcerait à **inventer** ce que le
 * site ne dit pas : un décodage contraint ne peut pas s'abstenir, il doit produire un jeton valide.
 *
 * L'adresse courriel d'une convention est son moyen de revendication, et un cas fabriqué a déjà
 * atteint la production. On retire donc tous les `required` : le modèle omet ce qu'il n'a pas
 * trouvé, et l'import refusera ensuite ce qui manque — avec un message, et sous les yeux de
 * quelqu'un.
 *
 * Ce que le schéma garantit malgré tout, et qui est l'essentiel : les NOMS des champs, leurs TYPES,
 * et un objet JSON seul en sortie.
 *
 * ## Ce qu'il ne garantit pas
 *
 * La forme, pas la vérité. Un fuseau reste une chaîne : « EDT » satisferait toujours ce schéma.
 * C'est `fuseau-depuis-import.ts` qui le rattrape, et il reste nécessaire.
 */

/** Un nœud de JSON Schema, tel que `z.toJSONSchema` le produit. */
type NoeudSchema = Record<string, unknown>

/**
 * Retire récursivement les listes `required`.
 *
 * Parcourt aussi les combinateurs (`anyOf`, `oneOf`, `allOf`) et les schémas d'éléments de
 * tableau : un champ obligatoire niché dans un `anyOf` contraindrait tout autant.
 */
export function sansChampsObligatoires<T>(noeud: T): T {
  if (Array.isArray(noeud)) return noeud.map((element) => sansChampsObligatoires(element)) as T
  if (noeud === null || typeof noeud !== 'object') return noeud

  const copie: NoeudSchema = {}
  for (const [cle, valeur] of Object.entries(noeud as NoeudSchema)) {
    if (cle === 'required') continue
    copie[cle] = sansChampsObligatoires(valeur)
  }
  return copie as T
}

/**
 * Le JSON Schema à imposer, dérivé d'un schéma Zod.
 *
 * `io: 'input'` décrit ce que le modèle doit PRODUIRE, et non ce que la validation rend après
 * transformation : le fuseau est normalisé à l'entrée, et décrire la sortie annoncerait au modèle
 * une forme qu'il n'a pas à fournir.
 *
 * `$schema` est retiré : LM Studio attend le schéma lui-même, pas un document autonome.
 */
export function schemaJsonDepuisZod(schemaZod: z.ZodType): NoeudSchema {
  const brut = z.toJSONSchema(schemaZod, { io: 'input' }) as NoeudSchema
  const { $schema: _ignore, ...schema } = brut
  return sansChampsObligatoires(schema)
}

/**
 * Le `response_format` d'une requête LM Studio.
 *
 * ⚠️ L'APPELANT DOIT SAVOIR S'EN PASSER. La documentation de LM Studio montre la forme sans
 * préciser la sémantique de `strict` ni le sort des champs facultatifs, et le serveur est celui de
 * l'utilisateur : on ne peut pas l'éprouver d'ici. Un refus ne doit donc pas faire échouer
 * l'extraction — voir le repli, côté appel.
 */
export function formatDeReponseJson(schema: NoeudSchema) {
  return {
    type: 'json_schema' as const,
    json_schema: {
      name: 'import_edition',
      strict: true,
      schema,
    },
  }
}
