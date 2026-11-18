import { describe, it, expect } from 'vitest'

import { prismaTest } from '../setup-db'

/**
 * Les colonnes acceptent ce que la validation d'entrée autorise.
 *
 * ## Le défaut
 *
 * Prisma crée un `String` MySQL en **`VARCHAR(191)`** — la limite d'index utf8mb4 — alors que six
 * schémas zod du dépôt plafonnent à **200**. Une saisie de 192 à 200 caractères passait donc la
 * validation et **cassait à l'écriture** : l'organisateur recevait une erreur serveur pour un texte
 * qu'on l'avait laissé taper, et rien à l'écran ne lui disait qu'il était trop long.
 *
 * Trouvé par accident en allongeant un titre d'essai dans une spec Playwright : le point d'API a
 * rendu un 500, et non un 400.
 *
 * ⚠️ **Le nom du champ ne suffit pas à conclure.** `title` existe en `VARCHAR(150)`, `(191)` et
 * `(200)` selon la table : c'est le couple (schéma zod, colonne de SA table) qui décide. Les six
 * paires ci-dessous ont été résolues modèle par modèle, pas par recherche de nom.
 *
 * ## Pourquoi un test d'intégration
 *
 * La largeur d'une colonne n'existe qu'en base. Un bouchon de Prisma accepte une chaîne de
 * n'importe quelle longueur, donc un test unitaire ou Nuxt resterait vert avec la colonne à 191 —
 * c'est exactement ce qui a laissé passer le défaut.
 */
describe.skipIf(!process.env.TEST_WITH_DB)('Plafonds de saisie et largeur des colonnes', () => {
  /** Les six paires corrigées par la migration `plafonds_de_saisie_alignes_sur_200`. */
  const PAIRES: { table: string; colonne: string }[] = [
    { table: 'CarpoolOffer', colonne: 'locationAddress' },
    { table: 'Edition', colonne: 'name' },
    { table: 'Feedback', colonne: 'subject' },
    { table: 'Task', colonne: 'title' },
    { table: 'TaskChecklistItem', colonne: 'title' },
    { table: 'Workshop', colonne: 'title' },
  ]

  /** Le plafond que les schémas zod de ces champs annoncent. */
  const PLAFOND_ZOD = 200

  it('les six colonnes acceptent au moins ce que zod autorise', async () => {
    const largeurs = await prismaTest.$queryRawUnsafe<
      { TABLE_NAME: string; COLUMN_NAME: string; CHARACTER_MAXIMUM_LENGTH: bigint | number }[]
    >(
      `SELECT TABLE_NAME, COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND (${PAIRES.map(() => '(TABLE_NAME = ? AND COLUMN_NAME = ?)').join(' OR ')})`,
      ...PAIRES.flatMap((p) => [p.table, p.colonne])
    )

    /*
     * ⚠️ D'ABORD QUE LA MESURE AIT TROUVÉ SES SIX COLONNES. Sans cette assertion, une table
     * renommée rendrait zéro ligne et le cas passerait au vert en ne vérifiant rien — le défaut
     * que ce dépôt a payé plusieurs fois.
     */
    expect(
      largeurs.length,
      `seules ${largeurs.length} des ${PAIRES.length} colonnes ont été trouvées : ` +
        `une table ou une colonne a changé de nom`
    ).toBe(PAIRES.length)

    const tropEtroites = largeurs
      .map((l) => ({ ...l, largeur: Number(l.CHARACTER_MAXIMUM_LENGTH) }))
      .filter((l) => l.largeur < PLAFOND_ZOD)
      .map((l) => `${l.TABLE_NAME}.${l.COLUMN_NAME} = ${l.largeur}`)

    expect(
      tropEtroites,
      `colonne(s) plus étroite(s) que le plafond zod de ${PLAFOND_ZOD} : ${tropEtroites.join(', ')} ` +
        `— une saisie de cette longueur passerait la validation et casserait à l'écriture`
    ).toEqual([])
  })

  it('une valeur de 200 caractères survit à l’aller-retour en base', async () => {
    /*
     * `Feedback` est pris pour sa simplicité : aucune relation obligatoire, donc aucune fixture.
     * Ce qui est éprouvé n'est pas ce modèle en particulier mais la largeur réellement appliquée
     * par MySQL — la contre-épreuve du cas précédent, qui ne lit qu'une métadonnée.
     */
    const SUJET = 'é'.repeat(PLAFOND_ZOD)
    expect(SUJET).toHaveLength(PLAFOND_ZOD)

    const cree = await prismaTest.feedback.create({
      data: {
        type: 'GENERAL',
        subject: SUJET,
        message: 'Vérifie que la colonne accepte 200 caractères.',
      },
      select: { id: true, subject: true },
    })

    try {
      // Relu de la base, et non repris de l'objet rendu : une troncature silencieuse se verrait ici.
      const relu = await prismaTest.feedback.findUniqueOrThrow({
        where: { id: cree.id },
        select: { subject: true },
      })
      expect(relu.subject).toHaveLength(PLAFOND_ZOD)
      expect(relu.subject).toBe(SUJET)
    } finally {
      await prismaTest.feedback.delete({ where: { id: cree.id } })
    }
  })
})
