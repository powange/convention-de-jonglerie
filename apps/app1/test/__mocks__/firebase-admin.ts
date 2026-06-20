/**
 * Mock Firebase Admin SDK pour les tests
 */
import { vi } from 'vitest'

// Types mock pour Firebase Admin
export interface MockApp {
  name: string
  options: Record<string, unknown>
}

export interface MockMessaging {
  send: ReturnType<typeof vi.fn>
  sendEachForMulticast: ReturnType<typeof vi.fn>
  subscribeToTopic: ReturnType<typeof vi.fn>
  unsubscribeFromTopic: ReturnType<typeof vi.fn>
}

// Mock de l'objet admin
const admin = {
  apps: [] as MockApp[],

  initializeApp: vi.fn((config?: any) => {
    const app: MockApp = {
      name: '[DEFAULT]',
      options: config || {},
    }
    admin.apps.push(app)
    return app
  }),

  messaging: vi.fn(
    (app?: MockApp): MockMessaging => ({
      send: vi.fn(async () => 'mock-message-id'),
      sendEachForMulticast: vi.fn(async () => ({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      })),
      subscribeToTopic: vi.fn(async () => undefined),
      unsubscribeFromTopic: vi.fn(async () => undefined),
    })
  ),

  credential: {
    cert: vi.fn((serviceAccount: any) => ({
      projectId: serviceAccount.projectId || serviceAccount.project_id,
      privateKey: serviceAccount.privateKey || serviceAccount.private_key,
      clientEmail: serviceAccount.clientEmail || serviceAccount.client_email,
    })),
  },
}

// Export types pour compatibilité TypeScript avec firebase-admin
export type AdminApp = MockApp
export type AdminMessaging = MockMessaging

export interface AdminMessage {
  notification?: {
    title?: string
    body?: string
  }
  data?: Record<string, string>
  topic?: string
  token?: string
}

export interface AdminMulticastMessage {
  notification?: {
    title?: string
    body?: string
  }
  data?: Record<string, string>
  tokens: string[]
}

export interface AdminBatchResponse {
  successCount: number
  failureCount: number
  responses: Array<{
    success: boolean
    error?: {
      code?: string
      message?: string
    }
  }>
}

export interface AdminServiceAccount {
  projectId?: string
  project_id?: string
  privateKey?: string
  private_key?: string
  clientEmail?: string
  client_email?: string
}

export default admin
