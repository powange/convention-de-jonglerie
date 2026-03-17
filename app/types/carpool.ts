import type { PublicUser } from '~/types'

export type CarpoolDirection = 'TO_EVENT' | 'FROM_EVENT'
export type BookingStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED'

export interface CarpoolBooking {
  id: number
  carpoolOfferId?: number
  requestId?: number
  seats: number
  message?: string
  status: BookingStatus
  createdAt: string
  updatedAt?: string
  requester: PublicUser
}

export interface CarpoolComment {
  id: number
  content: string
  createdAt: string
  updatedAt?: string
  user: PublicUser
}

export interface CarpoolOffer {
  id: number
  editionId?: number
  userId?: number
  tripDate: string
  locationCity: string
  locationAddress?: string
  availableSeats: number
  direction: CarpoolDirection
  remainingSeats?: number
  description?: string
  hasPhoneNumber?: boolean
  phoneNumber?: string | null
  smokingAllowed?: boolean
  petsAllowed?: boolean
  musicAllowed?: boolean
  createdAt: string
  updatedAt?: string
  user: PublicUser
  bookings?: CarpoolBooking[]
  passengers?: Array<{
    id: number
    addedAt: string
    user: PublicUser
  }>
  comments?: CarpoolComment[]
}

export interface CarpoolRequest {
  id: number
  editionId?: number
  userId?: number
  tripDate: string
  locationCity: string
  seatsNeeded: number
  direction: CarpoolDirection
  description?: string
  hasPhoneNumber?: boolean
  phoneNumber?: string | null
  createdAt: string
  updatedAt?: string
  user: PublicUser
  comments?: CarpoolComment[]
}
