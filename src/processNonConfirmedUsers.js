'use strict'

const AWS = require('aws-sdk')
const sleep = require('sleep-promise')
const logError = require('../utils/log-error')

AWS.config.update({ region: process.env.REGION })

// Create the DynamoDB service object
const ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' })

exports.handler = event => {
  // eslint-disable-next-line
  console.log(`${JSON.stringify(event)}`);
  // eslint-disable-next-line

  const putRequests = []
  event.users.forEach(user => {
    // eslint-disable-next-line
    console.log(`batching user ${JSON.stringify(user)}`);
    const email = user.Attributes[0].Value
    putRequests.push({
      PutRequest: {
        Item: {
          username: { S: email },
          created: { S: user.UserCreateDate }
        }
      }
    })
  })

  return writeToDynamo(putRequests)
}

const writeToDynamo = putRequests => {
  const listToProcess = putRequests.splice(0, 25)
  if (putRequests.length > 0) {
    writeToDynamo(putRequests)
  }

  const RequestItems = {}
  RequestItems[process.env.TABLE_NAME] = listToProcess
  return ddb.batchWriteItem({ RequestItems }).promise().then(() => {
    // eslint-disable-next-line
    // console.log(`Put ${message.email}`)
    return Promise.resolve(true)
  }).catch(error => {
    if (error.code === 'TooManyRequestsException') {
      // eslint-disable-next-line
      console.error(`TooManyRequestsException`, error);
      return sleep(Math.random() * 3000).then(() => {
        return writeToDynamo(putRequests)
      })
    } else {
      // eslint-disable-next-line
      console.error(`Error writing users`, error);
      const errorMessage = {
        putRequests
      }
      logError('process_non_confirmed_user', 'multiple', JSON.parse(errorMessage), error)
      throw error
    }
  })
}
