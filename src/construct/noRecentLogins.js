'use strict'
const AWS = require('aws-sdk')
const dates = require('../util/dates')
const Excel = require('exceljs')
const fs = require('fs')
const path = require('path')

AWS.config.update({ region: process.env.REGION })

// Create the DynamoDB service object
const ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' })
const s3 = new AWS.S3({ apiVersion: '2006-03-01' })
const FILENAME = '/Users/rich/Downloads/no_recent_logins.xlsx'

exports.handler = event => {
  // eslint-disable-next-line
  console.log(`${JSON.stringify(event)}`);

  const workbook = new Excel.Workbook()
  const sheet = workbook.addWorksheet('No Receent Logins', { properties: { tabColor: { argb: 'FFC0000' } } })
  const row = sheet.getRow(1)
  row.values = ['EMAIL', 'LAST LOGIN DATE']
  return readUnconfirmedUsers(sheet).then(() => {
    return readConfirmedUsers(event.job_id, sheet)
  }).then(() => {
    return workbook.xlsx.writeFile(FILENAME)
  }).then(() => {
    const fileStream = fs.createReadStream(FILENAME)
    fileStream.on('error', function (err) {
      // eslint-disable-next-line
      console.log('File Error', err);
    })
    const uploadParams = {
      Bucket: 'cwds.cognito.userlist',
      Key: path.basename(FILENAME),
      Body: fileStream
    }

    return s3.upload(uploadParams).promise()
  }).then(() => {
    return Promise.resolve(true)
  }).catch(error => {
    // eslint-disable-next-line
    console.error('Error scanning for confirmed users', error);
    throw error
  })
}

const readUnconfirmedUsers = sheet => {
  const params = {
    TableName: process.env.NON_CONFIRMED_USERS_TABLE_NAME
  }

  return ddb.scan(params).promise().then(results => {
    results.Items.forEach(element => {
      const username = element.username.S
      const created = element.created.S
      const epoch = Date.parse(created)
      if (dateOutsideOfRange(epoch)) {
        sheet.addRow([username, 'NO ACTIVITY'])
      }
    })
    return Promise.resolve(true)
  }).catch(error => {
    // eslint-disable-next-line
    console.error('Error scanning for non confirmed users', error);
    throw error
  })
}

const readConfirmedUsers = (jobId, sheet) => {
  const params = {
    TableName: process.env.CONFIRMED_USERS_TABLE_NAME,
    ExpressionAttributeValues: {
      ':j': {
        S: jobId
      }
    },
    FilterExpression: 'jobId = :j'
  }

  return ddb.scan(params).promise().then(results => {
    results.Items.forEach(element => {
      const username = element.username.S
      const created = element.created.S
      const lastLogin = JSON.parse(element.loginData.S).last_login

      let epoch = 0
      if (lastLogin !== 'NEVER') {
        epoch = Date.parse(lastLogin)
      } else {
        epoch = Date.parse(created)
      }
      if (dateOutsideOfRange(epoch)) {
        sheet.addRow([username, dates.formatEpoch(epoch)])
      }
    })
    return Promise.resolve(true)
  }).catch(error => {
    // eslint-disable-next-line
    console.error('Error scanning for confirmed users', error);
    throw error
  })
}

const dateOutsideOfRange = dateEpoch => {
  const rangeBegin = new Date()
  rangeBegin.setDate(rangeBegin.getDate() - 30)

  const date = new Date()
  date.setTime(dateEpoch)

  return rangeBegin > date
}
