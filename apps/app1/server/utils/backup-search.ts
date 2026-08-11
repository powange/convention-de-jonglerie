import { execFile } from 'child_process'
import { randomBytes } from 'crypto'
import { createReadStream } from 'fs'
import { mkdir, rm } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { createInterface } from 'readline'
import { promisify } from 'util'

import { createError } from 'h3'

import { Prisma } from '../generated/prisma/client'

import { backupsDir, listBackupFiles } from './backup-files'

const execFileAsync = promisify(execFile)

export interface SearchableColumn {
  name: string
  type: string
}

export interface SearchableTable {
  name: string
  columns: SearchableColumn[]
  /** false : table vue uniquement dans d'anciennes sauvegardes, absente du schéma actuel */
  inCurrentSchema: boolean
}

/**
 * Tables et colonnes du schéma actuel, dérivées du DMMF Prisma.
 * Les champs de relation (`kind: 'object'`) sont écartés : ils n'existent pas en base.
 */
export function listSearchableTables(): SearchableTable[] {
  return Prisma.dmmf.datamodel.models
    .map((model) => ({
      name: model.dbName || model.name,
      columns: model.fields
        .filter((field) => field.kind !== 'object' && !field.isList)
        .map((field) => ({ name: field.dbName || field.name, type: field.type })),
      inCurrentSchema: true,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

const isSafeIdentifier = (value: string) => /^[A-Za-z0-9_]+$/.test(value)

export interface SearchRequest {
  table: string
  columns: string[]
  filterColumn?: string
  filterValue?: string
  limit: number
}

/**
 * Valide les identifiants de la demande.
 *
 * Volontairement syntaxique, et non restreinte au schéma actuel : une table ou une colonne
 * supprimée depuis reste présente dans les anciennes sauvegardes, et c'est précisément
 * là qu'on vient chercher une donnée disparue. Aucun risque à l'ouvrir — la recherche lit
 * le dump comme du texte, sans construire la moindre requête SQL ; l'identifiant ne sert
 * qu'à repérer une section et à nommer une colonne.
 */
export function validateSearchRequest(request: SearchRequest): void {
  const invalid = [
    request.table,
    ...request.columns,
    ...(request.filterColumn ? [request.filterColumn] : []),
  ]
    .filter((identifier) => !isSafeIdentifier(identifier))
    .join(', ')

  if (invalid) {
    throw createError({ status: 400, message: `Identifiant invalide: ${invalid}` })
  }
}

/**
 * Décode une valeur telle que mysqldump l'écrit.
 * Les chaînes sont entre quotes simples, avec les échappements MySQL classiques ;
 * les binaires sortent en `0x…` quand mysqldump juge la donnée non imprimable.
 */
export function parseSqlValue(raw: string): string | number | null {
  const value = raw.trim()

  if (value === 'NULL') return null

  if (value.startsWith("'")) {
    const body = value.slice(1, -1)
    let decoded = ''
    for (let i = 0; i < body.length; i += 1) {
      if (body[i] !== '\\') {
        decoded += body[i]
        continue
      }
      i += 1
      const escaped = body[i] ?? ''
      const sequences: Record<string, string> = {
        n: '\n',
        r: '\r',
        t: '\t',
        b: '\b',
        Z: '',
        '0': '\0',
      }
      decoded += sequences[escaped] ?? escaped
    }
    return decoded
  }

  if (/^0x[0-9a-f]+$/i.test(value)) {
    return `<binaire ${(value.length - 2) / 2} octets>`
  }

  const asNumber = Number(value)
  return Number.isNaN(asNumber) ? value : asNumber
}

/**
 * Découpe les valeurs d'un tuple `(…)` en tenant compte des quotes et des échappements :
 * une virgule ou une parenthèse à l'intérieur d'une chaîne ne sépare rien.
 */
export function splitTupleValues(tuple: string): string[] {
  const values: string[] = []
  let current = ''
  let inString = false

  for (let i = 0; i < tuple.length; i += 1) {
    const char = tuple[i]

    if (inString) {
      current += char
      if (char === '\\') {
        i += 1
        current += tuple[i] ?? ''
      } else if (char === "'") {
        inString = false
      }
      continue
    }

    if (char === "'") {
      inString = true
      current += char
    } else if (char === ',') {
      values.push(current)
      current = ''
    } else {
      current += char
    }
  }

  values.push(current)
  return values
}

/** Extrait les tuples `(…)` d'un fragment d'instruction INSERT. */
function extractTuples(fragment: string): string[] {
  const tuples: string[] = []
  let depth = 0
  let current = ''
  let inString = false

  for (let i = 0; i < fragment.length; i += 1) {
    const char = fragment[i]

    if (inString) {
      current += char
      if (char === '\\') {
        i += 1
        current += fragment[i] ?? ''
      } else if (char === "'") {
        inString = false
      }
      continue
    }

    if (char === "'") {
      inString = true
      current += char
    } else if (char === '(') {
      depth += 1
      if (depth === 1) current = ''
      else current += char
    } else if (char === ')') {
      depth -= 1
      if (depth === 0) tuples.push(current)
      else current += char
    } else if (depth > 0) {
      current += char
    }
  }

  return tuples
}

/**
 * Relève la structure d'un dump : chaque table et ses colonnes, dans l'ordre du CREATE TABLE.
 * Lecture en flux et sans parsing des données — seules les lignes de structure comptent.
 */
export async function scanDumpStructure(sqlFilePath: string): Promise<Map<string, string[]>> {
  const sectionMarker = '-- Table structure for table `'
  const structures = new Map<string, string[]>()

  const lines = createInterface({
    input: createReadStream(sqlFilePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })

  let currentTable: string | null = null
  let inCreateTable = false

  try {
    for await (const line of lines) {
      if (line.startsWith(sectionMarker)) {
        currentTable = line.slice(sectionMarker.length, line.lastIndexOf('`'))
        structures.set(currentTable, [])
        inCreateTable = false
        continue
      }
      if (!currentTable) continue

      if (line.startsWith('CREATE TABLE')) {
        inCreateTable = true
        continue
      }
      if (!inCreateTable) continue

      const trimmed = line.trim()
      if (trimmed.startsWith('`')) {
        structures.get(currentTable)?.push(trimmed.slice(1, trimmed.indexOf('`', 1)))
      } else if (trimmed.startsWith(')')) {
        inCreateTable = false
      }
    }
  } finally {
    lines.close()
  }

  return structures
}

/**
 * Mémoïsation du relevé de structure : une sauvegarde est un fichier figé, son schéma ne
 * change pas. La clé inclut taille et date pour qu'un fichier remplacé soit relu.
 */
const structureCache = new Map<string, Map<string, string[]>>()

/**
 * Tables et colonnes proposables à la recherche : le schéma actuel, enrichi de tout ce que
 * les sauvegardes contiennent encore. Une table supprimée depuis, ou une colonne renommée,
 * reste ainsi accessible — c'est le cas d'usage même de la fonctionnalité.
 */
export async function collectSearchableTables(): Promise<SearchableTable[]> {
  const tables = new Map<string, SearchableTable>()

  for (const current of listSearchableTables()) {
    tables.set(current.name, { ...current, columns: [...current.columns] })
  }

  for (const backup of await listBackupFiles()) {
    const cacheKey = `${backup.filename}:${backup.size}:${backup.createdAt}`
    let structures = structureCache.get(cacheKey)

    if (!structures) {
      let tempDir: string | null = null
      try {
        const opened = await openBackupSql(backup.filename)
        tempDir = opened.tempDir
        structures = await scanDumpStructure(opened.sqlPath)
        structureCache.set(cacheKey, structures)
      } catch (error) {
        // Une sauvegarde illisible ne doit pas priver l'écran des autres
        console.warn(`[BACKUP-SEARCH] Structure illisible (${backup.filename}):`, error)
        continue
      } finally {
        if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => {})
      }
    }

    for (const [tableName, columns] of structures) {
      const known = tables.get(tableName)
      if (!known) {
        tables.set(tableName, {
          name: tableName,
          columns: columns.map((name) => ({ name, type: 'inconnu' })),
          inCurrentSchema: false,
        })
        continue
      }
      // Colonnes disparues du schéma mais encore présentes dans d'anciennes sauvegardes
      const seen = new Set(known.columns.map((column) => column.name))
      for (const name of columns) {
        if (!seen.has(name)) known.columns.push({ name, type: 'inconnu' })
      }
    }
  }

  return [...tables.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export interface DumpScanResult {
  rows: Record<string, string | number | null>[]
  tableFound: boolean
}

/**
 * Parcourt un dump mysqldump et relève, pour une table donnée, les lignes demandées.
 *
 * Lecture directe plutôt que rechargement dans une base temporaire : l'utilisateur MySQL
 * applicatif n'a de droits que sur sa propre base (aucun INSERT ailleurs), et surtout une
 * section de dump commence par `DROP TABLE` — la charger au mauvais endroit détruirait les
 * données de production. Ici rien n'est écrit nulle part.
 *
 * Le format s'y prête : mysqldump échappe les sauts de ligne, donc aucune valeur ne
 * traverse deux lignes du fichier, et la lecture peut rester en flux.
 */
export async function scanDumpForTable(
  sqlFilePath: string,
  request: SearchRequest
): Promise<DumpScanResult> {
  const sectionMarker = '-- Table structure for table `'
  const targetMarker = `${sectionMarker}${request.table}\``
  const insertPrefix = `INSERT INTO \`${request.table}\` VALUES`

  const lines = createInterface({
    input: createReadStream(sqlFilePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })

  const columns: string[] = []
  const rows: DumpScanResult['rows'] = []
  let inSection = false
  let inCreateTable = false
  let inInsert = false
  let tableFound = false

  try {
    for await (const line of lines) {
      if (line.startsWith(sectionMarker)) {
        if (inSection) break // section suivante : la table est derrière nous
        inSection = line.startsWith(targetMarker)
        tableFound ||= inSection
        continue
      }
      if (!inSection) continue

      // Colonnes, dans l'ordre du CREATE TABLE : les INSERT ne les nomment pas
      if (line.startsWith('CREATE TABLE')) {
        inCreateTable = true
        continue
      }
      if (inCreateTable) {
        const trimmed = line.trim()
        if (trimmed.startsWith('`')) {
          columns.push(trimmed.slice(1, trimmed.indexOf('`', 1)))
        } else if (trimmed.startsWith(')')) {
          inCreateTable = false
        }
        continue
      }

      let fragment: string | null = null
      if (line.startsWith(insertPrefix)) {
        fragment = line.slice(insertPrefix.length)
        inInsert = true
      } else if (inInsert) {
        fragment = line
      }
      if (fragment === null) continue

      for (const tuple of extractTuples(fragment)) {
        const values = splitTupleValues(tuple).map(parseSqlValue)
        const row = Object.fromEntries(columns.map((column, index) => [column, values[index]]))

        if (request.filterColumn) {
          const actual = row[request.filterColumn]
          if (String(actual ?? '') !== (request.filterValue ?? '')) continue
        }

        rows.push(
          Object.fromEntries(request.columns.map((column) => [column, row[column] ?? null]))
        )
        if (rows.length >= request.limit) return { rows, tableFound: true }
      }

      if (fragment.trimEnd().endsWith(';')) inInsert = false
    }
  } finally {
    lines.close()
  }

  return { rows, tableFound }
}

/**
 * Rend accessible le fichier .sql d'une sauvegarde. Pour une archive, seul le membre `.sql`
 * est extrait : les uploads pèsent souvent bien plus lourd que le dump et ne servent à rien ici.
 */
async function openBackupSql(
  filename: string
): Promise<{ sqlPath: string; tempDir: string | null }> {
  const backupPath = path.join(backupsDir(), path.basename(filename))

  if (!filename.endsWith('.tar.gz')) {
    return { sqlPath: backupPath, tempDir: null }
  }

  const tempDir = path.join(tmpdir(), `backup-search-${randomBytes(6).toString('hex')}`)
  await mkdir(tempDir, { recursive: true })

  try {
    const { stdout } = await execFileAsync('tar', ['-tzf', backupPath], {
      maxBuffer: 1024 * 1024 * 20,
    })
    const member = stdout
      .split('\n')
      .map((entry) => entry.trim())
      .find((entry) => entry.endsWith('.sql'))

    if (!member) throw new Error("aucun fichier SQL dans l'archive")

    await execFileAsync('tar', ['-xzf', backupPath, '-C', tempDir, member], {
      maxBuffer: 1024 * 1024 * 100,
    })

    return { sqlPath: path.join(tempDir, member), tempDir }
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    throw error
  }
}

export interface BackupSearchResult {
  filename: string
  createdAt: string
  /** Lignes trouvées ; vide si la table existe mais ne contient rien qui corresponde. */
  rows: Record<string, string | number | null>[]
  /** La table n'existe pas dans cette sauvegarde (schéma plus ancien, par exemple). */
  tableMissing?: boolean
  /** Sauvegarde illisible : signalé plutôt que compté comme « rien trouvé ». */
  error?: string
}

/**
 * Interroge chaque sauvegarde, de la plus récente à la plus ancienne, et rend un résultat
 * dès qu'il est disponible. L'échec d'une sauvegarde n'interrompt pas les suivantes.
 */
export async function* searchBackups(
  request: SearchRequest,
  options: { signal?: { aborted: boolean } } = {}
): AsyncGenerator<BackupSearchResult & { index: number; total: number }> {
  validateSearchRequest(request)

  const backups = await listBackupFiles()

  for (const [index, backup] of backups.entries()) {
    if (options.signal?.aborted) return

    const base = {
      filename: backup.filename,
      createdAt: backup.createdAt,
      index,
      total: backups.length,
    }
    let tempDir: string | null = null

    try {
      const opened = await openBackupSql(backup.filename)
      tempDir = opened.tempDir

      const { rows, tableFound } = await scanDumpForTable(opened.sqlPath, request)
      yield { ...base, rows, tableMissing: !tableFound }
    } catch (error: unknown) {
      yield {
        ...base,
        rows: [],
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      }
    } finally {
      if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    }
  }
}
