'use strict'
const AWS = require('aws-sdk')
const dates = require('../util/dates')
const Excel = require('exceljs')
const fs = require('fs')
const path = require('path')
const dateFormat = require('dateformat')

AWS.config.update({ region: process.env.REGION })

// Create the DynamoDB service object
const ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' })
const s3 = new AWS.S3({ apiVersion: '2006-03-01' })
const FILENAME = `/Users/rich/Downloads/NoRecentLogins_${dateFormat(new Date(), 'mmmm_dd_yyyy')}.xlsx`

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
const sheet = workbook.addWorksheet('No Recent Logins', {})
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

const loginsArray = []

exports.handler = event => {
  // eslint-disable-next-line
  console.log(`${JSON.stringify(event)}`);

  sheet.columns = [
    { header: 'EMAIL', key: 'email', width: 32, style },
    { header: 'LAST LOGIN DATE', key: 'date', width: 32, style }
  ]
  return readUnconfirmedUsers(sheet).then(() => {
    return readConfirmedUsers(event.job_id, sheet)
  }).then(() => {
    loginsArray.sort((a, b) => {
      return a.epoch - b.epoch
    })

    loginsArray.forEach(element => {
      let formattedEpoch = 'NO ACTIVITY'
      if (element.epoch > -1) {
        formattedEpoch = dates.formatEpoch(element.epoch)
      }
      sheet.addRow([element.username, formattedEpoch])
    })
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
        const activity = {
          username,
          epoch: -1
        }

        loginsArray.push(activity)
        // sheet.addRow([username, 'NO ACTIVITY'])
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
        const activity = {
          username,
          epoch
        }

        loginsArray.push(activity)
        // sheet.addRow([username, dates.formatEpoch(epoch)])
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
