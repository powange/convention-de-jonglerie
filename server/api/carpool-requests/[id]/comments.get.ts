import { getCommentsForEntity } from '../../../utils/commentsHandler'

export default defineEventHandler(async (event) => {
  return getCommentsForEntity(event, {
    entityType: 'carpoolRequest',
    entityIdField: 'carpoolRequestId'
  })
})