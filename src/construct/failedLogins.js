'use strict'
const AWS = require('aws-sdk')
const dates = require('../util/dates')
const Excel = require('exceljs')

const fs = require('fs')
const path = require('path')
const dateFormat = require('dateformat')
const FILENAME = `/Users/rich/Downloads/FailedLogins_${dateFormat(dates.mondayLastWeek(), 'mmm-dd-yyyy')}-to-${dateFormat(dates.recentSunday(), 'mmm-dd-yyyy')}.xlsx`

AWS.config.update({ region: process.env.REGION })

// Create the DynamoDB service object
const ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' })
const s3 = new AWS.S3({ apiVersion: '2006-03-01' })

const headerFont = {
  name: 'Calibri',
  bold: true,
  size: 14
}

const headerFill = {
  type: 'pattern',
  pattern: 'lightGray'
}

const workbook = new Excel.Workbook()
const sheet = workbook.addWorksheet('Failed Logins', {})
const style = {
  font: {
    name: 'Calibri',
    bold: false,
    size: 11
  },
  border: {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  },
  alignment: {
    vertical: 'middle',
    horizontal: 'center'
  },
  fill: {
    type: 'pattern',
    pattern: 'none'
  }
}

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

  sheet.columns = [
    { header: 'EMAIL', key: 'email', width: 32, style },
    { header: 'FAILED LOGIN DATE', key: 'date', width: 32, style }
  ]

  const loginsArray = []
  return ddb.scan(params).promise().then(results => {
    results.Items.forEach(element => {
      const username = element.username.S
      const failedLoginsLastWeek = JSON.parse(element.loginData.S).failed_logins_last_week

      failedLoginsLastWeek.forEach(login => {
        const epoch = Date.parse(login.date)
        const date = new Date()
        date.setTime(epoch)
        const failedLogin = {
          username,
          epoch
        }
        loginsArray.push(failedLogin)
        // sheet.addRow([username, dates.formatEpoch(epoch)])
      })
    })
    loginsArray.sort((a, b) => {
      return b.epoch - a.epoch
    })

    loginsArray.forEach(element => sheet.addRow([element.username, dates.formatEpoch(element.epoch)]))
    return Promise.resolve(true)
  }).then(() => {
    sheet.getCell('A1').fill = headerFill
    sheet.getCell('A1').font = headerFont
    sheet.getCell('B1').fill = headerFill
    sheet.getCell('B1').font = headerFont
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
    console.error('Error writing report', error);
    throw error
  })
}
