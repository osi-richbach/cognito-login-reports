'use strict'
const AWS = require('aws-sdk')
const sleep = require('sleep-promise')
const dates = require('../utils/dates')
const logError = require('../utils/log-error')

// Create the DynamoDB service object
const ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10', region: process.env.REGION })
const csp = new AWS.CognitoIdentityServiceProvider({ apiVersion: '2016-04-18', region: process.env.REGION })

exports.handler = event => {
  // eslint-disable-next-line
  console.log(`${JSON.stringify(event)}`);

  const userData = []
  return processUsers(event.users, userData).then(() => {
    return createRequestItems(userData)
  }).catch(error => {
    // eslint-disable-next-line
    console.error(`Error writing confirmed users`, error);
    logError('process_non_confirmed_user', 'multiple', JSON.parse(event), error)
    throw error
  })
}

const createRequestItems = userData => {
  const deleteRequests = []
  const putRequests = []
  userData.forEach(userData => {
    const email = userData.user.Attributes[0].Value
    deleteRequests.push({
      DeleteRequest: {
        Key: {
          username: { S: email }
        }
      }
    })

    putRequests.push({
      PutRequest: {
        Item: {
          username: { S: email },
          jobId: { S: 'placeholder' },
          created: { S: userData.user.UserCreateDate },
          loginData: { S: JSON.stringify({ logins_last_week: userData.loginsLastWeek, failed_logins_last_week: userData.failedLoginsLastWeek, last_login: userData.lastLoginDate }) }
        }
      }
    })
  })

  return writeToDynamo(process.env.LOGIN_REPORT_TABLE_NAME, putRequests).then(() => {
    return writeToDynamo(process.env.NON_CONFIRMED_USERS_TABLE_NAME, deleteRequests)
  })
}

const processUsers = (users, userData) => {
  if (users.length === 0) {
    return Promise.resolve(true)
  }
  return processUser(users.pop(), userData).then(() => {
    return processUsers(users, userData)
  })
}

const processUser = (user, userData) => {
  const email = user.Attributes[0].Value
  // eslint-disable-next-line
  console.log(`processing user ${email}`);

  const allSuccessfulLoginsList = []
  const allFailedLoginsList = []
  let lastLoginDate
  let successfulLoginsLastWeek
  let failedLoginsLastWeek

  return findLogins(user, allSuccessfulLoginsList, allFailedLoginsList).then(() => {
    return findLastLoginDate(user.Username, allSuccessfulLoginsList, allFailedLoginsList)
  }).then(foundLastLoginDate => {
    lastLoginDate = foundLastLoginDate
    return Promise.resolve(true)
  }).then(() => {
    successfulLoginsLastWeek = findAuthEventsWithinDateRange(allSuccessfulLoginsList)
    failedLoginsLastWeek = findAuthEventsWithinDateRange(allFailedLoginsList)
    return Promise.resolve(true)
  }).then(() => {
    userData.push({
      user,
      lastLoginDate,
      loginsLastWeek: successfulLoginsLastWeek,
      failedLoginsLastWeek: failedLoginsLastWeek
    })
    return Promise.resolve(true)
  })
}

const findLogins = (user, allSuccessfulLoginsList, allFailedLoginsList, nextToken = undefined) => {
  const email = user.Attributes[0].Value
  const adminListUserAuthEventsParams = {
    UserPoolId: process.env.USER_POOL_ID,
    Username: user.Username,
    MaxResults: 60
  }

  if (nextToken !== undefined) {
    adminListUserAuthEventsParams.NextToken = nextToken
  }

  return sleep(Math.random() * 10).then(() => {
    return csp.adminListUserAuthEvents(adminListUserAuthEventsParams).promise()
  }).then(response => {
    response.AuthEvents.forEach(authEvent => {
      if (isSuccessfulUserLogin(authEvent)) {
        const loginDate = new Date(authEvent.CreationDate)
        // eslint-disable-next-line
        console.log(`Found login for ${email} - ${loginDate},${authEvent.EventContextData.City}`);
        allSuccessfulLoginsList.push(authEvent)
      } else if (isFailedUserLogin(authEvent)) {
        const loginDate = new Date(authEvent.CreationDate)
        // eslint-disable-next-line
        console.log(`Found failed login for ${email} - ${loginDate},${authEvent.EventContextData.City}`);
        allFailedLoginsList.push(authEvent)
      }
    })
    if (response.NextToken !== undefined) {
      return findLogins(user, allSuccessfulLoginsList, allFailedLoginsList, response.NextToken)
    }
    return Promise.resolve(true)
  }).catch(error => {
    if (error.code === 'TooManyRequestsException') {
      // eslint-disable-next-line
      console.error(`TooManyRequestsException ${email}`, error);
      return sleep(Math.random() * 500).then(() => {
        return findLogins(user, allSuccessfulLoginsList, allFailedLoginsList, nextToken)
      })
    } else {
      // eslint-disable-next-line
      console.error(`Error while retrieving authentication events for ${email}`, error);
      logError('process_confirmed_user', 'multiple', email, error)
      throw error
    }
  })
}

const isSuccessfulUserLogin = authEvent => {
  if (authEvent.EventType === 'SignIn' && authEvent.EventResponse === 'Pass' && authEvent.EventContextData.City !== 'Boardman') {
    return true
  }

  return false
}

const isFailedUserLogin = authEvent => {
  if (authEvent.EventType === 'SignIn' && authEvent.EventResponse === 'Fail') {
    return true
  }

  return false
}

const findLastLoginDate = (username, loginList) => {
  let lastLoginDate
  if (loginList.length > 0) {
    lastLoginDate = new Date(loginList[0].CreationDate)
  } else {
    lastLoginDate = undefined
  }
  return Promise.resolve(lastLoginDate)
}

const findAuthEventsWithinDateRange = authEvents => {
  const loginAttemptsLastWeek = []
  const lastMonday = (0, dates.mondayLastWeek)()
  const thisMonday = (0, dates.mondayThisWeek)()
  /* eslint-disable */
  console.log(`Last Monday is ${lastMonday}`);
  console.log(`This Monday is ${thisMonday}`);
  /* eslint-enable */

  let index = 0
  for (; index < authEvents.length; index++) {
    const authEvent = authEvents[index]
    const loginDate = new Date(authEvent.CreationDate)
    if (loginDate >= lastMonday && loginDate < thisMonday) {
      loginAttemptsLastWeek.push({ date: loginDate, city: authEvent.EventContextData.City })
    } else if (loginDate < lastMonday) {
      break
    }
  }
  return loginAttemptsLastWeek
}

const writeToDynamo = (table, requestItems) => {
  const listToProcess = requestItems.splice(0, 25)
  if (requestItems.length > 0) {
    writeToDynamo(table, requestItems)
  }

  const RequestItems = {}
  RequestItems[table] = listToProcess
  return ddb.batchWriteItem({ RequestItems }).promise().then(() => {
    return Promise.resolve(true)
  }).catch(error => {
    if (error.code === 'TooManyRequestsException') {
      // eslint-disable-next-line
      console.error(`TooManyRequestsException`, error);
      return sleep(Math.random() * 3000).then(() => {
        return writeToDynamo(table, requestItems)
      })
    } else {
      // eslint-disable-next-line
      console.error(`Error writing users`, error);
      const errorMessage = {
        requestItems
      }
      logError('process_confirmed_user', 'multiple', JSON.parse(errorMessage), error)
      throw error
    }
  })
}
