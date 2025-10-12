import { z } from 'zod'

import { requireAuth } from '../../../../../utils/auth-utils'
import { fetchOrdersFromHelloAsso } from '../../../../../utils/editions/ticketing/helloasso'

const bodySchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  organizationSlug: z.string().min(1),
  formType: z.string().min(1),
  formSlug: z.string().min(1),
  pageIndex: z.number().optional(),
  pageSize: z.number().optional(),
})

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const body = bodySchema.parse(await readBody(event))

  try {
    const result = await fetchOrdersFromHelloAsso(
      {
        clientId: body.clientId,
        clientSecret: body.clientSecret,
      },
      {
        organizationSlug: body.organizationSlug,
        formType: body.formType,
        formSlug: body.formSlug,
      },
      {
        withDetails: true,
        pageIndex: body.pageIndex,
        pageSize: body.pageSize,
      }
    )

    return {
      success: true,
      orders: result.data,
      pagination: result.pagination,
    }
  } catch (error: any) {
    console.error('HelloAsso orders error:', error)
    throw error
  }
})
