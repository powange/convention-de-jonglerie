/**
 * Store en mémoire pour les tâches asynchrones
 * Utilisé pour les opérations longues comme la génération IA
 */

export interface AsyncTask<T = unknown> {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: Date
  updatedAt: Date
  result?: T
  error?: string
  progress?: number
  metadata?: Record<string, unknown>
}

// Store en mémoire (sera vidé au redémarrage du serveur)
const tasks = new Map<string, AsyncTask>()

// Durée de vie des tâches en mémoire (30 minutes)
const TASK_TTL = 30 * 60 * 1000

/**
 * Génère un ID unique pour une tâche
 */
function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Crée une nouvelle tâche asynchrone
 */
export function createTask<T = unknown>(metadata?: Record<string, unknown>): AsyncTask<T> {
  const task: AsyncTask<T> = {
    id: generateTaskId(),
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata,
  }

  tasks.set(task.id, task as AsyncTask)

  // Nettoyer les anciennes tâches
  cleanupOldTasks()

  return task
}

/**
 * Récupère une tâche par son ID
 */
export function getTask<T = unknown>(taskId: string): AsyncTask<T> | undefined {
  return tasks.get(taskId) as AsyncTask<T> | undefined
}

/**
 * Met à jour le statut d'une tâche
 */
export function updateTaskStatus(
  taskId: string,
  status: AsyncTask['status'],
  progress?: number
): void {
  const task = tasks.get(taskId)
  if (task) {
    task.status = status
    task.updatedAt = new Date()
    if (progress !== undefined) {
      task.progress = progress
    }
  }
}

/**
 * Marque une tâche comme terminée avec son résultat
 */
export function completeTask<T>(taskId: string, result: T): void {
  const task = tasks.get(taskId)
  if (task) {
    task.status = 'completed'
    task.result = result
    task.updatedAt = new Date()
    task.progress = 100
  }
}

/**
 * Marque une tâche comme échouée avec une erreur
 */
export function failTask(taskId: string, error: string): void {
  const task = tasks.get(taskId)
  if (task) {
    task.status = 'failed'
    task.error = error
    task.updatedAt = new Date()
  }
}

/**
 * Supprime une tâche
 */
export function deleteTask(taskId: string): boolean {
  return tasks.delete(taskId)
}

/**
 * Nettoie les tâches expirées
 */
function cleanupOldTasks(): void {
  const now = Date.now()

  for (const [id, task] of tasks.entries()) {
    const age = now - task.createdAt.getTime()
    if (age > TASK_TTL) {
      tasks.delete(id)
    }
  }
}

/**
 * Exécute une fonction async en arrière-plan et met à jour la tâche
 */
export function runTaskInBackground<T>(taskId: string, fn: () => Promise<T>): void {
  // Marquer comme en cours
  updateTaskStatus(taskId, 'processing')

  // Exécuter en arrière-plan (sans await)
  fn()
    .then((result) => {
      completeTask(taskId, result)
    })
    .catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error)
      failTask(taskId, errorMessage)
      console.error(`[AsyncTask ${taskId}] Erreur:`, errorMessage)
    })
}
