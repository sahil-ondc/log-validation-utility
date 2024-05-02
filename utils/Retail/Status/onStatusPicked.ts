/* eslint-disable no-prototype-builtins */
import _ from 'lodash'
import constants, { ApiSequence } from '../../../constants'
import { logger } from '../../../shared/logger'
import { validateSchema, isObjectEmpty, checkContext, areTimestampsLessThanOrEqualTo, compareTimeRanges } from '../..'
import { getValue, setValue } from '../../../shared/dao'

export const checkOnStatusPicked = (data: any, state: string, msgIdSet: any) => {
  const onStatusObj: any = {}
  try {
    if (!data || isObjectEmpty(data)) {
      return { [ApiSequence.ON_STATUS_PICKED]: 'JSON cannot be empty' }
    }

    const { message, context }: any = data
    if (!message || !context || isObjectEmpty(message)) {
      return { missingFields: '/context, /message, is missing or empty' }
    }

    const searchContext: any = getValue(`${ApiSequence.SEARCH}_context`)
    const schemaValidation = validateSchema(context.domain.split(':')[1], constants.ON_STATUS, data)
    const contextRes: any = checkContext(context, constants.ON_STATUS)

    if (schemaValidation !== 'error') {
      Object.assign(onStatusObj, schemaValidation)
    }

    if (!contextRes?.valid) {
      Object.assign(onStatusObj, contextRes.ERRORS)
    }

    try {
      logger.info(`Adding Message Id /${constants.ON_STATUS_PICKED}`)
      if (msgIdSet.has(context.message_id)) {
        onStatusObj[`${ApiSequence.ON_STATUS_PICKED}_msgId`] = `Message id should not be same with previous calls`
      }
      msgIdSet.add(context.message_id)
    } catch (error: any) {
      logger.error(`!!Error while checking message id for /${constants.ON_STATUS_PICKED}, ${error.stack}`)
    }

    if (!_.isEqual(data.context.domain.split(':')[1], getValue(`domain`))) {
      onStatusObj[`Domain[${data.context.action}]`] = `Domain should be same in each action`
    }

    setValue(`${ApiSequence.ON_STATUS_PICKED}`, data)

    // const pending_message_id: string | null = getValue('pending_message_id')
    // const picked_message_id: string = context.message_id

    // setValue(`picked_message_id`, picked_message_id)

    // try {
    //   logger.info(
    //     `Comparing message_id for unsolicited calls for ${constants.ON_STATUS}.pending and ${constants.ON_STATUS}.picked`,
    //   )
    //   if (pending_message_id === picked_message_id) {
    //     logger.error(`Message_id cannot be same for ${constants.ON_STATUS}.pending and ${constants.ON_STATUS}.picked`)
    //     onStatusObj['invalid_message_id_picked'] =
    //       `Message_id cannot be same for ${constants.ON_STATUS}.pending and ${constants.ON_STATUS}.picked`
    //   }
    // } catch (error: any) {
    //   logger.error(
    //     `Error while comparing message_id for ${constants.ON_STATUS}.pending and ${constants.ON_STATUS}.picked`,
    //   )
    // }

    try {
      logger.info(`Checking context for /${constants.ON_STATUS} API`) //checking context
      const res: any = checkContext(context, constants.ON_STATUS)
      if (!res.valid) {
        Object.assign(onStatusObj, res.ERRORS)
      }
    } catch (error: any) {
      logger.error(`!!Some error occurred while checking /${constants.ON_STATUS} context, ${error.stack}`)
    }

    try {
      logger.info(`Comparing city of /${constants.SEARCH} and /${constants.ON_STATUS}`)
      if (!_.isEqual(searchContext.city, context.city)) {
        onStatusObj.city = `City code mismatch in /${constants.SEARCH} and /${constants.ON_STATUS}`
      }
    } catch (error: any) {
      logger.error(`!!Error while comparing city in /${constants.SEARCH} and /${constants.ON_STATUS}, ${error.stack}`)
    }

    try {
      logger.info(`Comparing transaction Ids of /${constants.SELECT} and /${constants.ON_STATUS}`)
      if (!_.isEqual(getValue('txnId'), context.transaction_id)) {
        onStatusObj.txnId = `Transaction Id should be same from /${constants.SELECT} onwards`
      }
    } catch (error: any) {
      logger.info(
        `!!Error while comparing transaction ids for /${constants.SELECT} and /${constants.ON_STATUS} api, ${error.stack}`,
      )
    }

    const on_status = message.order
    try {
      logger.info(`Comparing order Id in /${constants.ON_CONFIRM} and /${constants.ON_STATUS}_${state}`)
      if (on_status.id != getValue('cnfrmOrdrId')) {
        logger.info(`Order id (/${constants.ON_STATUS}_${state}) mismatches with /${constants.CONFIRM})`)
        onStatusObj.onStatusOdrId = `Order id in /${constants.CONFIRM} and /${constants.ON_STATUS}_${state} do not match`
      }
    } catch (error) {
      logger.info(
        `!!Error while comparing order id in /${constants.ON_STATUS}_${state} and /${constants.CONFIRM}`,
        error,
      )
    }
    try {
      logger.info(`Comparing timestamp of /${constants.ON_STATUS}_picked and /${constants.ON_STATUS}_${state} API`)
      if (_.gte(getValue('tmpstmp'), context.timestamp)) {
        onStatusObj.inVldTmstmp = `Timestamp in previous /${constants.ON_STATUS} api cannot be greater than or equal to /${constants.ON_STATUS}_${state} api`
      }

      setValue('tmpstmp', context.timestamp)
    } catch (error: any) {
      logger.error(`!!Error occurred while comparing timestamp for /${constants.ON_STATUS}_${state}, ${error.stack}`)
    }
    try {
      logger.info(`Comparing timestamp of /${constants.ON_CONFIRM} and /${constants.ON_STATUS}_${state} API`)
      if (_.gte(getValue('onCnfrmtmpstmp'), context.timestamp)) {
        onStatusObj.tmpstmp1 = `Timestamp for /${constants.ON_CONFIRM} api cannot be greater than or equal to /${constants.ON_STATUS}_${state} api`
      }
    } catch (error: any) {
      logger.error(`!!Error occurred while comparing timestamp for /${constants.ON_STATUS}_${state}, ${error.stack}`)
    }

    const contextTime = context.timestamp
    try {
      logger.info(`Comparing order.updated_at and context timestamp for /${constants.ON_STATUS}_${state} API`)
      if (!_.isEqual(on_status.created_at, getValue(`cnfrmTmpstmp`))) {
        onStatusObj.tmpstmp = `Created At timestamp for /${constants.ON_STATUS}_${state} should be equal to context timestamp at ${constants.CONFIRM}`
      }

      if (!areTimestampsLessThanOrEqualTo(on_status.updated_at, contextTime)) {
        onStatusObj.tmpstmp2 = ` order.updated_at timestamp should be less than or eqaul to  context timestamp for /${constants.ON_STATUS}_${state} api`
      }
    } catch (error: any) {
      logger.error(
        `!!Error occurred while comparing order updated at for /${constants.ON_STATUS}_${state}, ${error.stack}`,
      )
    }

    try {
      logger.info(`Checking order state in /${constants.ON_STATUS}_${state}`)
      if (on_status.state != 'In-progress') {
        onStatusObj.ordrState = `order/state should be "In-progress" for /${constants.ON_STATUS}_${state}`
      }
    } catch (error: any) {
      logger.error(`!!Error while checking order state in /${constants.ON_STATUS}_${state} Error: ${error.stack}`)
    }

    try {
      logger.info(`Checking pickup timestamp in /${constants.ON_STATUS}_${state}`)
      const noOfFulfillments = on_status.fulfillments.length
      let orderPicked = false
      let i = 0
      const pickupTimestamps: any = {}

      while (i < noOfFulfillments) {
        const fulfillment = on_status.fulfillments[i]
        const ffState = fulfillment.state.descriptor.code

        //type should be Delivery
        if (fulfillment.type != 'Delivery') {
          i++
          continue
        }

        if (ffState === constants.ORDER_PICKED) {
          orderPicked = true
          const pickUpTime = fulfillment.start?.time.timestamp
          pickupTimestamps[fulfillment.id] = pickUpTime
          if (!pickUpTime) {
            onStatusObj.pickUpTime = `picked timestamp is missing`
          } else {
            try {
              //checking pickup time matching with context timestamp
              if (!_.lte(pickUpTime, contextTime)) {
                onStatusObj.pickupTime = `pickup timestamp should match context/timestamp and can't be future dated`
              }
            } catch (error) {
              logger.error(
                `!!Error while checking pickup time matching with context timestamp in /${constants.ON_STATUS}_${state}`,
                error,
              )
            }

            try {
              //checking order/updated_at timestamp
              if (!_.gte(on_status.updated_at, pickUpTime)) {
                onStatusObj.updatedAt = `order/updated_at timestamp can't be less than the pickup time`
              }

              if (!_.gte(contextTime, on_status.updated_at)) {
                onStatusObj.updatedAtTime = `order/updated_at timestamp can't be future dated (should match context/timestamp)`
              }
            } catch (error) {
              logger.error(
                `!!Error while checking order/updated_at timestamp in /${constants.ON_STATUS}_${state}`,
                error,
              )
            }
          }
        }

        i++
      }

      try {
        logger.info(`comparing fulfillment ranges `)
        const storedFulfillment = getValue(`deliveryFulfillment`)
        const deliveryFulfillment = on_status.fulfillments.filter((fulfillment: any) => fulfillment.type === 'Delivery')
        const fulfillmentRangeerrors = compareTimeRanges(storedFulfillment, deliveryFulfillment[0])
        if (fulfillmentRangeerrors) {
          let i = 0
          const len = fulfillmentRangeerrors.length
          while (i < len) {
            const key = `fulfilmntRngErr${i}`
            onStatusObj[key] = `${fulfillmentRangeerrors[i]}`
            i++
          }
        }
      } catch (error: any) {
        logger.error(`Error while comparing fulfillment ranges , ${error.stack}`)
      }
      try {
        // Checking fulfillment.id, fulfillment.type and tracking
        logger.info('Checking fulfillment.id, fulfillment.type and tracking')
        on_status.fulfillments.forEach((ff: any) => {
          let ffId = ''

          if (!ff.id) {
            logger.info(`Fulfillment Id must be present `)
            onStatusObj['ffId'] = `Fulfillment Id must be present`
          }

          ffId = ff.id

          if (getValue(`${ffId}_tracking`)) {
            if (ff.tracking === false || ff.tracking === true) {
              if (getValue(`${ffId}_tracking`) != ff.tracking) {
                logger.info(`Fulfillment Tracking mismatch with the ${constants.ON_SELECT} call`)
                onStatusObj['ffTracking'] = `Fulfillment Tracking mismatch with the ${constants.ON_SELECT} call`
              }
            } else {
              logger.info(`Tracking must be present for fulfillment ID: ${ff.id} in boolean form`)
              onStatusObj['ffTracking'] = `Tracking must be present for fulfillment ID: ${ff.id} in boolean form`
            }
          }
        })
      } catch (error: any) {
        logger.info(`Error while checking fulfillments id, type and tracking in /${constants.ON_STATUS}`)
      }

      setValue('pickupTimestamps', pickupTimestamps)

      if (!orderPicked) {
        onStatusObj.noOrdrPicked = `fulfillments/state should be ${constants.ORDER_PICKED} for /${constants.ON_STATUS}_${constants.ORDER_PICKED}`
      }
    } catch (error: any) {
      logger.info(
        `Error while checking pickup timestamp in /${constants.ON_STATUS}_${state}.json Error: ${error.stack}`,
      )
    }

    return onStatusObj
  } catch (err: any) {
    logger.error(`!!Some error occurred while checking /${constants.ON_STATUS} API`, err)
  }
}
