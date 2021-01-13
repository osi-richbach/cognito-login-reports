'use strict'
const AWS = require('aws-sdk')
const dates = require('./util/dates')
const fs = require('fs')
const path = require('path')
const dateFormat = require('dateformat')
const FILENAME = `/Users/rich/Downloads/SuccessfulLoginRepoprt_${dateFormat(dates.mondayLastWeek(), 'mmm-dd-yyyy')}-to-${dateFormat(dates.recentSunday(), 'mmm-dd-yyyy')}.xlsx`

AWS.config.update({ region: process.env.REGION })

const s3 = new AWS.S3({ apiVersion: '2006-03-01' })

// Create the DynamoDB service object
const ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' })

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

  const wstream = fs.createWriteStream(FILENAME)
  wstream.on('finish', function () {
    // eslint-disable-next-line
    console.log('file has been written');
  })
  wstream.write('EMAIL,DATE,DAY,CITY\n')

  const dayOfWeekCounter = {}
  const hourOfDayPerDayCounter = {}
  const hourOfDayCounter = {}
  return ddb.scan(params).promise().then(results => {
    results.Items.forEach(element => {
      const username = element.username.S
      const loginsLastWeek = JSON.parse(element.loginData.S).logins_last_week

      loginsLastWeek.forEach(login => {
        const epoch = Date.parse(login.date)
        const date = new Date()
        date.setTime(epoch)
        incrementLoginsForDay(dayOfWeekCounter, date.getDay())
        incrementLoginsForHourOnThisDay(hourOfDayPerDayCounter, date.getDay(), date.getHours())
        incrementLoginsForHourOfDay(hourOfDayCounter, date.getHours())
        // console.log(`${username},${formatEpoch(epoch)},${dayOfWeek(date)},${login.city}`)
        wstream.write(`${username},${(0, dates.formatEpoch)(epoch)},${(0, dates.dayOfWeek)(date)},${login.city}\n`)
      })

      return Promise.resolve(true)
    })
  }).then(() => {
    /* eslint-disable */
    wstream.write('\n\n');
    wstream.write('Logins/Day For XXX Y - XXX Y\n');

    const days = Object.keys(dayOfWeekCounter).sort();
    days.push(days.shift());
    days.forEach(day => {
      wstream.write(`${(0, dates.cookDay)(parseInt(day))},${dayOfWeekCounter[day]}\n`);
    });
    /* eslint-enable */

    return Promise.resolve(true)
  }).then(() => {
    /* eslint-disable */
    wstream.write('\n\n');
    wstream.write('Logins Per Hour XXX Y - XXX Y\n');
    const hours = Object.keys(hourOfDayCounter).sort((a, b) => {
      return parseInt(a) - parseInt(b);
    });
    hours.forEach(hour => {
      wstream.write(`${hour},${hourOfDayCounter[hour]}\n`);
    });
    /* eslint-enable */

    return Promise.resolve(true)
  }).then(() => {
    /* eslint-disable */
    wstream.write('\n\n');
    wstream.write('Logins/Hour/Day For XXX Y - XXX Y\n');
    const days = Object.keys(hourOfDayPerDayCounter).sort();
    days.push(days.shift());
    days.forEach(day => {
      const hoursOfDay = Object.keys(hourOfDayPerDayCounter[day]).sort((a, b) => {
        return parseInt(a) - parseInt(b);
      });
      hoursOfDay.forEach(hour => {
        wstream.write(`${(0, dates.cookDay)(parseInt(day))},${hour},${hourOfDayPerDayCounter[day][hour]}\n`);
      });
    });
    /* eslint-enable */
    wstream.end()
    return Promise.resolve(true)
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
  }).catch(error => {
    // eslint-disable-next-line
    console.error('Error scanning for confirmed users', error);
    throw error
  })
}

const incrementLoginsForDay = (dayOfWeekCounter, day) => {
  const dayString = day.toString()
  const loginThisDay = dayOfWeekCounter[dayString] === undefined ? 1 : dayOfWeekCounter[dayString] + 1
  dayOfWeekCounter[dayString] = loginThisDay
}

const incrementLoginsForHourOnThisDay = (hourOfDayPerDayCounter, day, hour) => {
  const dayString = day.toString()
  const hourString = hour.toString()
  const loginsThisDay = hourOfDayPerDayCounter[dayString] === undefined ? {} : hourOfDayPerDayCounter[dayString]

  const loginsThisHour = loginsThisDay[hourString] === undefined ? 1 : loginsThisDay[hourString] + 1
  loginsThisDay[hourString] = loginsThisHour

  hourOfDayPerDayCounter[dayString] = loginsThisDay
}

const incrementLoginsForHourOfDay = (hourOfDayCounter, hour) => {
  const hourString = hour.toString()
  const loginThisHour = hourOfDayCounter[hourString] === undefined ? 1 : hourOfDayCounter[hourString] + 1
  hourOfDayCounter[hourString] = loginThisHour
}
