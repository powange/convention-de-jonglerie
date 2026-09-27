import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Les champs réellement déclarés par un modèle Prisma, lus dans le schéma.
 *
 * Sert aux tests des ports repas, où Prisma est bouché par un mock : une écriture visant une
 * colonne inexistante y passe sans bruit, et une assertion qui recopie le littéral du code la
 * fige au lieu de l'attraper. C'est arrivé — `selected` au lieu d'`accepted` sur les deux
 * sélections de repas, figé par deux tests, corrigé le 27/09/2026.
 *
 * On lit donc le schéma plutôt que de redire ce que le code écrit : la garde reste valable pour
 * le prochain nom de colonne mal orthographié, là où une valeur attendue en dur ne l'est que
 * pour celui-ci.
 *
 * Le chemin part du répertoire de travail et non d'`import.meta.url` : dans l'environnement de
 * test Nuxt, ce dernier n'est pas une URL `file:` et `readFileSync` la refuse.
 */
function cheminDuSchema(): string {
  const candidats = [
    join(process.cwd(), 'prisma/schema/meals.prisma'),
    join(process.cwd(), 'apps/app1/prisma/schema/meals.prisma'),
  ]
  const trouve = candidats.find((chemin) => existsSync(chemin))
  if (!trouve) throw new Error(`meals.prisma introuvable (essayé : ${candidats.join(', ')})`)
  return trouve
}

export function champsDuModele(modele: string): string[] {
  const schema = readFileSync(cheminDuSchema(), 'utf-8')
  const bloc = new RegExp(`model ${modele}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(schema)
  if (!bloc) throw new Error(`Modèle ${modele} absent de meals.prisma`)

  return bloc[1]!
    .split('\n')
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne && !ligne.startsWith('//') && !ligne.startsWith('@@'))
    .map((ligne) => ligne.split(/\s+/)[0]!)
}
