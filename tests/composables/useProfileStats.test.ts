import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useProfileStats } from '../../app/composables/useProfileStats'
import type { ProfileStats } from '../../app/types'

// Mock $fetch
const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

describe('useProfileStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with default values', () => {
    const { stats, loading, error } = useProfileStats()

    expect(stats.value).toBeNull()
    expect(loading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('should fetch stats successfully', async () => {
    const mockStats = {
      conventionsCreated: 3,
      editionsFavorited: 5,
      favoritesReceived: 12,
    }

    mockFetch.mockResolvedValueOnce(mockStats)

    const { stats, loading, error, fetchStats } = useProfileStats()

    const fetchPromise = fetchStats()

    // Should be loading during fetch
    expect(loading.value).toBe(true)

    await fetchPromise

    // Should have loaded successfully
    expect(loading.value).toBe(false)
    expect(error.value).toBeNull()
    expect(stats.value).toEqual(mockStats)
    expect(mockFetch).toHaveBeenCalledWith('/api/profile/stats')
  })

  it('should handle fetch errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { stats, loading, error, fetchStats } = useProfileStats()

    await fetchStats()

    expect(loading.value).toBe(false)
    expect(error.value).toBe('Impossible de charger les statistiques')
    expect(stats.value).toBeNull()
  })

  it('should only initialize once with ensureInitialized', async () => {
    const mockStats = {
      conventionsCreated: 1,
      editionsFavorited: 2,
      favoritesReceived: 3,
    }

    mockFetch.mockResolvedValue(mockStats)

    const { ensureInitialized } = useProfileStats()

    // First call should fetch
    await ensureInitialized()
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Second call should not fetch
    await ensureInitialized()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
