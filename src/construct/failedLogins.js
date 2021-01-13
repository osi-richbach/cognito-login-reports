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
exports.handler = async (event) => {
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

const readUserLogins = async (jobId) => {
  const params = {
    TableName: process.env.LOGIN_REPORT_TABLE_NAME,
    ExpressionAttributeValues: {
      ':j': {
        S: jobId
      }
    },
    FilterExpression: 'jobId = :j'
  }

  const workbook = new Excel.Workbook()
  const sheet = workbook.addWorksheet('Failed Logins', { properties: { tabColor: { argb: 'FFC0000' } } })
  const row = sheet.getRow(1)
  row.values = ['EMAIL', 'FAILED LOGIN DATE']

  const filename = '/Users/rich/Downloads/failed_logins.xlsx'

  return ddb.scan(params).promise().then(results => {
    results.Items.forEach(element => {
      const username = element.username.S
      const failedLoginsLastWeek = JSON.parse(element.loginData.S).failed_logins_last_week

      failedLoginsLastWeek.forEach(login => {
        const epoch = Date.parse(login.date)
        const date = new Date()
        date.setTime(epoch)
        sheet.addRow([username, dates.formatEpoch(epoch)])
      })
    })
  }).then(() => {
    return workbook.xlsx.writeFile(filename)
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
