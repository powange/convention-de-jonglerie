import { execFile } from 'child_process'
import { mkdir, rm, writeFile } from 'fs/promises'
import path from 'path'
import { promisify } from 'util'

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { backupsDir } from '../../server/utils/backup-files'
import {
  listSearchableTables,
  scanDumpForTable,
  searchBackups,
  validateSearchRequest,
} from '../../server/utils/backup-search'
import { prismaTest } from '../setup-db'

const execFileAsync = promisify(execFile)

// Ce fichier ne s'exécute que si TEST_WITH_DB=true
describe.skipIf(!process.env.TEST_WITH_DB)('Recherche dans les sauvegardes (dump réel)', () => {
  const description =
    'Rejoignez notre équipe 🎪\n\nDeuxième ligne avec une "quote" et un \\ antislash'
  let eventId: number
  let dumpFilename: string
  let dumpPath: string

  beforeAll(async () => {
    const ts = Date.now()

    const author = await prismaTest.user.create({
      data: {
        email: `backup-search-${ts}@example.com`,
        emailHash: `hash-backup-search-${ts}`,
        password: 'hashed',
        pseudo: `backup-search-${ts}`,
        isEmailVerified: true,
      },
    })
    const convention = await prismaTest.convention.create({
      data: { name: `Convention backup-search ${ts}`, authorId: author.id },
    })
    const eventAnchor = await prismaTest.event.create({ data: {} })
    await prismaTest.edition.create({
      data: {
        id: eventAnchor.id,
        eventId: eventAnchor.id,
        name: `Édition backup-search ${ts}`,
        conventionId: convention.id,
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-03'),
        addressLine1: '1 rue du Test',
        city: 'Paris',
        country: 'France',
        postalCode: '75001',
      },
    })
    eventId = eventAnchor.id

    // La donnée que la recherche devra retrouver dans la sauvegarde
    await prismaTest.eventVolunteerSettings.create({
      data: { eventId, open: true, mode: 'INTERNAL', description },
    })

    // Une seconde ligne : la CI part d'une base vierge, et le test de limite doit
    // pouvoir constater qu'on lui rend moins de lignes qu'il n'en existe.
    const secondAnchor = await prismaTest.event.create({ data: {} })
    await prismaTest.edition.create({
      data: {
        id: secondAnchor.id,
        eventId: secondAnchor.id,
        name: `Édition backup-search bis ${ts}`,
        conventionId: convention.id,
        startDate: new Date('2024-07-01'),
        endDate: new Date('2024-07-03'),
        addressLine1: '2 rue du Test',
        city: 'Lyon',
        country: 'France',
        postalCode: '69001',
      },
    })
    await prismaTest.eventVolunteerSettings.create({
      data: { eventId: secondAnchor.id, open: false, mode: 'INTERNAL', description: 'Autre' },
    })

    // Dump réel, avec les mêmes options que create.post.ts
    const url = new URL(process.env.TEST_DATABASE_URL || (process.env.DATABASE_URL as string))
    const { stdout } = await execFileAsync(
      'mysqldump',
      [
        `-h${url.hostname}`,
        `-P${url.port || '3306'}`,
        `-u${url.username}`,
        // Sans cela, `-h localhost` fait basculer le client sur le socket Unix et
        // ignore le port : en CI la base est un service TCP, sans socket local.
        '--protocol=TCP',
        '--single-transaction',
        '--add-drop-table',
        '--quick',
        '--extended-insert',
        '--no-tablespaces',
        url.pathname.slice(1),
      ],
      {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 200,
        env: { ...process.env, MYSQL_PWD: url.password },
      }
    )

    dumpFilename = `test-backup-search-${ts}.sql`
    dumpPath = path.join(backupsDir(), dumpFilename)
    await mkdir(backupsDir(), { recursive: true })
    await writeFile(dumpPath, stdout)
  }, 120000)

  afterAll(async () => {
    if (dumpPath) await rm(dumpPath, { force: true })
  })

  it('expose les tables et colonnes du schéma Prisma', () => {
    const tables = listSearchableTables()
    const settings = tables.find((table) => table.name === 'EventVolunteerSettings')

    expect(settings).toBeDefined()
    expect(settings?.columns.map((column) => column.name)).toContain('description')
    // Les champs de relation n'existent pas en base et ne doivent pas être proposés
    expect(settings?.columns.map((column) => column.name)).not.toContain('event')
  })

  it('refuse une table ou une colonne hors schéma', () => {
    expect(() => validateSearchRequest({ table: 'Inconnue', columns: ['id'], limit: 10 })).toThrow(
      /Table inconnue/
    )

    expect(() =>
      validateSearchRequest({
        table: 'EventVolunteerSettings',
        columns: ['description; DROP TABLE Users'],
        limit: 10,
      })
    ).toThrow(/Colonne inconnue/)
  })

  it('ne lit que la section de la table demandée', async () => {
    const { rows, tableFound } = await scanDumpForTable(dumpPath, {
      table: 'EventVolunteerSettings',
      columns: ['eventId'],
      limit: 5,
    })

    expect(tableFound).toBe(true)
    expect(rows.length).toBeGreaterThan(0)
    // Les colonnes des autres tables ne doivent pas fuiter dans le résultat
    expect(Object.keys(rows[0] ?? {})).toEqual(['eventId'])
  })

  it('signale une table absente du dump', async () => {
    const { rows, tableFound } = await scanDumpForTable(dumpPath, {
      table: 'TableQuiNExistePas',
      columns: ['id'],
      limit: 5,
    })

    expect(tableFound).toBe(false)
    expect(rows).toHaveLength(0)
  })

  it('retrouve la valeur du champ pour la ligne filtrée', async () => {
    const results = []
    for await (const result of searchBackups({
      table: 'EventVolunteerSettings',
      columns: ['eventId', 'description'],
      filterColumn: 'eventId',
      filterValue: String(eventId),
      limit: 10,
    })) {
      results.push(result)
    }

    const found = results.find((result) => result.filename === dumpFilename)
    expect(found).toBeDefined()
    expect(found?.error).toBeUndefined()
    expect(found?.rows).toHaveLength(1)
    // La description traverse le dump intacte : emoji, saut de ligne, quote et antislash
    expect(found?.rows[0]?.description).toBe(description)
    expect(Number(found?.rows[0]?.eventId)).toBe(eventId)
  }, 180000)

  it('ne retourne aucune ligne pour un filtre sans correspondance', async () => {
    const results = []
    for await (const result of searchBackups({
      table: 'EventVolunteerSettings',
      columns: ['description'],
      filterColumn: 'eventId',
      filterValue: '-1',
      limit: 10,
    })) {
      results.push(result)
    }

    const found = results.find((result) => result.filename === dumpFilename)
    expect(found?.rows).toHaveLength(0)
    expect(found?.error).toBeUndefined()
  }, 180000)

  it('respecte la limite de lignes demandée', async () => {
    const { rows } = await scanDumpForTable(dumpPath, {
      table: 'EventVolunteerSettings',
      columns: ['eventId'],
      limit: 1,
    })

    // Deux lignes existent dans le dump : la limite doit n'en rendre qu'une
    expect(rows).toHaveLength(1)
  })

  it("n'écrit rien : la donnée en base est intacte après la recherche", async () => {
    for await (const _result of searchBackups({
      table: 'EventVolunteerSettings',
      columns: ['description'],
      limit: 1,
    })) {
      // on consomme le flux jusqu'au bout
    }

    const settings = await prismaTest.eventVolunteerSettings.findUnique({ where: { eventId } })
    expect(settings?.description).toBe(description)
  }, 180000)
})
