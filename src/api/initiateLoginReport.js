'use strict'

const AWS = require('aws-sdk')

const stepFunctions = new AWS.StepFunctions()

module.exports.handler = function (event, context, callback) {
  // eslint-disable-next-line
  console.log(event);
  const page = JSON.parse(event.body).page
  initiateStepFunction(page).then(data => {
    const response = {
      statusCode: 201,
      body: JSON.stringify(data)
    }
    return callback(null, response)
  }).catch(error => {
    const response = {
      statusCode: 500,
      body: JSON.stringify(error)
    }
    return callback(error, response)
  })
}

function initiateStepFunction (page) {
  const input = {
    find_users: {
      next_page_token: page
    }
  }
  const params = {
    stateMachineArn: process.env.STATE_MACHINE_ARN,
    input: JSON.stringify(input)
  }
  return stepFunctions.startExecution(params).promise()
}
