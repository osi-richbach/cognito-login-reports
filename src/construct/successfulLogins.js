'use strict'
const AWS = require('aws-sdk')
const Excel = require('exceljs')
const dates = require('../util/dates')
const fs = require('fs')
const path = require('path')
const dateFormat = require('dateformat')
const FILENAME = `/Users/rich/Downloads/SuccessfulLoginReport_${dateFormat(dates.mondayLastWeek(), 'mmm-dd-yyyy')}-to-${dateFormat(dates.recentSunday(), 'mmm-dd-yyyy')}.xlsx`

AWS.config.update({ region: process.env.REGION })

const s3 = new AWS.S3({ apiVersion: '2006-03-01' })

const border = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' }
}

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
const sheet = workbook.addWorksheet('Successful_Logins', {})
const style = {
  font: {
    name: 'Calibri',
    bold: false,
    size: 11
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

sheet.columns = [
  { header: 'EMAIL', key: 'email', width: 32, style },
  { header: 'DATE', key: 'date', width: 32, style },
  { header: 'DAY', key: 'day', width: 12, style },
  { header: 'CITY', key: 'city', width: 20, style }
]

// Create the DynamoDB service object
const ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' })

const fiveWeeksAgo = dates.weekRange(5)
const fourWeeksAgo = dates.weekRange(4)
const threeWeeksAgo = dates.weekRange(3)
const twoWeeksAgo = dates.weekRange(2)
const oneWeeksAgo = dates.weekRange(1)

const fiveWeeksAgoLogins = []
const fourWeeksAgoLogins = []
const threeWeeksAgoLogins = []
const twoWeeksAgoLogins = []
const oneWeeksAgoLogins = []

exports.inRange = (range, date) => {
  return date >= range.start && date < range.end
}

exports.sortOnValues = (obj) => {
  const array = Object.keys(obj).map((key) => [key, obj[key]])
  array.sort((a, b) => {
    return b[1] - a[1]
  })

  return array
}

exports.maxDayHour = (obj) => {
  const maxDayHour = {
    day: 'null',
    hour: -1,
    count: -1
  }

  Object.keys(obj).map(day => {
    Object.keys(obj[day]).map(hour => {
      const count = obj[day][hour]
      if (count > maxDayHour.count) {
        maxDayHour.count = count
        maxDayHour.day = day
        maxDayHour.hour = hour
      }
      return null
    })
    return null
  })

  return maxDayHour
}

exports.parseWeek = (loginsArray) => {
  const dayOfWeekCounter = {}
  const hourOfDayPerDayCounter = {}
  const hourOfDayCounter = {}
  const cityCounter = {}

  loginsArray.sort((a, b) => {
    return Date.parse(b.date) - Date.parse(a.date)
  })

  loginsArray.forEach(login => {
    const epoch = Date.parse(login.date)
    const date = new Date()
    date.setTime(epoch)
    incrementLoginsForDay(dayOfWeekCounter, date.getDay())
    incrementLoginsForHourOnThisDay(hourOfDayPerDayCounter, date.getDay(), date.getHours())
    incrementLoginsForHourOfDay(hourOfDayCounter, date.getHours())
    incrementCityCount(cityCounter, login.city)
  })

  return {
    dayOfWeekCounter: this.sortOnValues(dayOfWeekCounter),
    maxDayHour: this.maxDayHour(hourOfDayPerDayCounter),
    hourOfDayCounter: this.sortOnValues(hourOfDayCounter),
    cityCounter: this.sortOnValues(cityCounter)
  }
}

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

  return ddb.scan(params).promise().then(results => {
    results.Items.forEach(element => {
      const username = element.username.S
      // NOTE : logins_last_week is a bad name, it is logins from the last 5 weeks.
      const loginsLastWeek = JSON.parse(element.loginData.S).logins_last_week

      loginsLastWeek.forEach(login => {
        const epoch = Date.parse(login.date)
        const date = new Date()
        date.setTime(epoch)
        let loginsArray = null
        if (this.inRange(fiveWeeksAgo, date)) {
          loginsArray = fiveWeeksAgoLogins
        } else if (this.inRange(fourWeeksAgo, date)) {
          loginsArray = fourWeeksAgoLogins
        } else if (this.inRange(threeWeeksAgo, date)) {
          loginsArray = threeWeeksAgoLogins
        } else if (this.inRange(twoWeeksAgo, date)) {
          loginsArray = twoWeeksAgoLogins
        } else if (this.inRange(oneWeeksAgo, date)) {
          loginsArray = oneWeeksAgoLogins
        }
        // wstream.write(`${username},${(0, dates.formatEpoch)(epoch)},${(0, dates.dayOfWeek)(date)},${login.city}\n`)
        if (loginsArray !== null) {
          loginsArray.push({
            username,
            date,
            city: login.city
          })
        }
      })
    })

    return Promise.resolve(true)
  }).then(() => {
    const oneWeeksAgoParsed = this.parseWeek(oneWeeksAgoLogins)
    const twoWeeksAgoParsed = this.parseWeek(twoWeeksAgoLogins)
    const threeWeeksAgoParsed = this.parseWeek(threeWeeksAgoLogins)
    const fourWeeksAgoParsed = this.parseWeek(fourWeeksAgoLogins)
    const fiveWeeksAgoParsed = this.parseWeek(fiveWeeksAgoLogins)

    return Promise.resolve(
      oneWeeksAgoParsed,
      twoWeeksAgoParsed,
      threeWeeksAgoParsed,
      fourWeeksAgoParsed,
      fiveWeeksAgoParsed
    )
  }).then((parsedData) => {
    // print Peak day hour day/hour
    let rowNum = 2
    oneWeeksAgoLogins.forEach(element => {
      const row = sheet.getRow(rowNum)
      const epoch = Date.parse(element.date)
      const date = new Date(epoch)
      console.log(dates.cookDay(date.getDay()))
      row.values = [element.username, dates.formatEpoch(epoch), dates.cookDay(date.getDay()), element.city]
      sheet.getCell(`A${rowNum}`).border = border
      sheet.getCell(`B${rowNum}`).border = border
      sheet.getCell(`C${rowNum}`).border = border
      sheet.getCell(`D${rowNum}`).border = border

      rowNum++
    })

    return Promise.resolve(parsedData)
  }).then((parsedData) => {
    // print logins for last week

  }).then((parsedData) => {
    // print total logins
    // console.log(`5=${fiveWeeksAgoLogins.length}`)
    // console.log(`4=${fourWeeksAgoLogins.length}`)
    // console.log(`3=${threeWeeksAgoLogins.length}`)
    // console.log(`2=${twoWeeksAgoLogins.length}`)
    // console.log(`1=${oneWeeksAgoLogins.length}`)

    return Promise.resolve(parsedData)
  }).then(() => {
    // print total logins per hour of day

    return Promise.resolve(true)
  }).then(() => {
    // print top 10 cities

    return Promise.resolve(true)
  }).then(() => {
    // print missing cities

    return Promise.resolve(true)
  }).then(() => {
    /* eslint-disable */
    // wstream.write('\n\n');
    // wstream.write('Logins/Day For XXX Y - XXX Y\n');

    // const days = Object.keys(dayOfWeekCounter).sort();
    // days.push(days.shift());
    // days.forEach(day => {
    //   wstream.write(`${(0, dates.cookDay)(parseInt(day))},${dayOfWeekCounter[day]}\n`);
    // });
    // /* eslint-enable */

    return Promise.resolve(true)
  }).then(() => {
    // /* eslint-disable */
    // wstream.write('\n\n');
    // wstream.write('Logins Per Hour XXX Y - XXX Y\n');
    // const hours = Object.keys(hourOfDayCounter).sort((a, b) => {
    //   return parseInt(a) - parseInt(b);
    // });
    // hours.forEach(hour => {
    //   wstream.write(`${hour},${hourOfDayCounter[hour]}\n`);
    // });
    // /* eslint-enable */

    return Promise.resolve(true)
  }).then(() => {
    /* eslint-disable */
    // wstream.write('\n\n');
    // wstream.write('Logins/Hour/Day For XXX Y - XXX Y\n');
    // const days = Object.keys(hourOfDayPerDayCounter).sort();
    // days.push(days.shift());
    // days.forEach(day => {
    //   const hoursOfDay = Object.keys(hourOfDayPerDayCounter[day]).sort((a, b) => {
    //     return parseInt(a) - parseInt(b);
    //   });
    //   hoursOfDay.forEach(hour => {
    //     wstream.write(`${(0, dates.cookDay)(parseInt(day))},${hour},${hourOfDayPerDayCounter[day][hour]}\n`);
    //   });
    // });
    // /* eslint-enable */
    // wstream.end()
    return Promise.resolve(true)
  }).then(() => {
    sheet.getCell('A1').fill = headerFill
    sheet.getCell('A1').font = headerFont
    sheet.getCell('A1').border = border
    sheet.getCell('B1').fill = headerFill
    sheet.getCell('B1').font = headerFont
    sheet.getCell('B1').border = border
    sheet.getCell('C1').fill = headerFill
    sheet.getCell('C1').font = headerFont
    sheet.getCell('C1').border = border
    sheet.getCell('D1').fill = headerFill
    sheet.getCell('D1').font = headerFont
    sheet.getCell('D1').border = border
    return workbook.xlsx.writeFile(FILENAME)    
    // const uploadParams = {
    //   Bucket: 'cwds.cognito.userlist',
    //   Key: path.basename(FILENAME),
    //   Body: fileStream
    // }

    // return s3.upload(uploadParams).promise()
        return Promise.resolve(true)
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

const incrementCityCount = (cityCounter, city) => {
  const cityCount = cityCounter[city] === undefined ? 1 : cityCounter[city] + 1
  cityCounter[city] = cityCount
}