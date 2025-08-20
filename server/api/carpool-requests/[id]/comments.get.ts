import { getCommentsForEntity } from '~/server/utils/commentsHandler'

export default defineEventHandler(async (event) => {
  return getCommentsForEntity(event, {
    entityType: 'carpoolRequest',
    entityIdField: 'carpoolRequestId'
  })
})