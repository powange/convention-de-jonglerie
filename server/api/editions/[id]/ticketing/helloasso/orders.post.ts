import { requireAuth } from '@@/server/utils/auth-utils'
import { fetchOrdersFromHelloAsso } from '@@/server/utils/editions/ticketing/helloasso'
import { validateEditionId } from '@@/server/utils/validation-helpers'
import { z } from 'zod'

const bodySchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  organizationSlug: z.string().min(1),
  formType: z.string().min(1),
  formSlug: z.string().min(1),
  pageIndex: z.number().optional(),
  pageSize: z.number().optional(),
})

export default wrapApiHandler(
  async (event) => {
    requireAuth(event)
    validateEditionId(event)

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
    } catch (error: unknown) {
      console.error('HelloAsso orders error:', error)
      throw error
    }
  },
  { operationName: 'POST ticketing helloasso orders' }
)
