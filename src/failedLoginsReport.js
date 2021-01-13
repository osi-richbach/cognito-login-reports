'use strict'
const AWS = require('aws-sdk')
const dates = require('./util/dates')
const fs = require('fs')
const path = require('path')

AWS.config.update({ region: process.env.REGION })

// Create the DynamoDB service object
const ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' })
const s3 = new AWS.S3({ apiVersion: '2006-03-01' })
exports.handler = event => {
  // eslint-disable-next-line
  console.log(`${JSON.stringify(event)}`);

  return readUserLogins(event.job_id).then(() => {
    return true
  }).catch(error => {
    // eslint-disable-next-line
    console.error('Error scanning for confirmed users', error);
    throw error
  })
}

const readUserLogins = jobId => {
  const params = {
    TableName: process.env.LOGIN_REPORT_TABLE_NAME,
    ExpressionAttributeValues: {
      ':j': {
        S: jobId
      }
    },
    FilterExpression: 'jobId = :j'
  }
  const filename = '/tmp/failed_logins.csv'
  return ddb.scan(params).promise().then(results => {
    const wstream = fs.createWriteStream(filename)
    wstream.on('finish', function () {
      // eslint-disable-next-line
      console.log('file has been written');
    })
    wstream.write('EMAIL,FAILED LOGIN DATE\n')
    results.Items.forEach(element => {
      const username = element.username.S
      const failedLoginsLastWeek = JSON.parse(element.loginData.S).failed_logins_last_week

      failedLoginsLastWeek.forEach(login => {
        const epoch = Date.parse(login.date)
        const date = new Date()
        date.setTime(epoch)
        wstream.write(`${username},${(0, dates.formatEpoch)(epoch)}\n`)
      })
    })
    wstream.end()
    return Promise.resolve(true)
  }).then(() => {
    const fileStream = fs.createReadStream(filename)
    fileStream.on('error', function (err) {
      // eslint-disable-next-line
      console.log('File Error', err);
    })
    const uploadParams = {
      Bucket: 'cwds.cognito.userlist',
      Key: path.basename(filename),
      Body: fileStream
    }

    return s3.upload(uploadParams).promise()
  }).then(() => {
    return Promise.resolve(true)
  }).catch(error => {
    // eslint-disable-next-line
    console.error('Error writing report', error);
    throw error
  })
}
