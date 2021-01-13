'use strict'
const AWS = require('aws-sdk')
const Excel = require('exceljs')
const dates = require('../util/dates')
const fs = require('fs')
const path = require('path')
const dateFormat = require('dateformat')
const { title } = require('process')
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
  { header: 'CITY', key: 'city', width: 20, style },
  { header: '', key: '', width: 20, style },
  { header: '', key: '', width: 20, style },
  { header: '', key: '', width: 16, style },
  { header: 'TOTAL LOGINS', key: '1', width: 32, style },
  { header: 'TOTAL LOGINS', key: '2', width: 32, style },
  { header: 'TOTAL LOGINS', key: '3', width: 32, style },
  { header: 'TOTAL LOGINS', key: '4', width: 32, style }
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

exports.setHeaderCell = (cell, title) => {
  cell.value = title
  cell.font = headerFont
  cell.alignment = style.alignment
  cell.border = border
  cell.fill = headerFill
}

exports.setCell = (cell, title) => {
  cell.value = title
  cell.font = style.font
  cell.alignment = style.alignment
  cell.border = border
  cell.fill = style.fill
}

exports.setLoginsForDay = (cell, loginsPerDayObject, day) => {
  let count = loginsPerDayObject[`${day}`]
  if (count === undefined) {
    count = 0
  }
  this.setCell(cell, count)
}

exports.printLoginsForDay = (row, parsedData, day) => {
  this.setLoginsForDay(row.getCell(8), parsedData.fourWeeksAgoParsed.dayOfWeekCounterObject, day)
  this.setLoginsForDay(row.getCell(9), parsedData.threeWeeksAgoParsed.dayOfWeekCounterObject, day)
  this.setLoginsForDay(row.getCell(10), parsedData.twoWeeksAgoParsed.dayOfWeekCounterObject, day)
  this.setLoginsForDay(row.getCell(11), parsedData.oneWeeksAgoParsed.dayOfWeekCounterObject, day)
}

exports.setLoginsForHour = (cell, loginsPerHourObject, hour) => {
  let count = loginsPerHourObject[`${hour}`]
  if (count === undefined) {
    count = 0
  }

  this.setCell(cell, count)
}

exports.printLoginsForHourOfDay = (row, parsedData, hour) => {
  this.setLoginsForHour(row.getCell(8), parsedData.fourWeeksAgoParsed.hourOfDayCounterObject, hour)
  this.setLoginsForHour(row.getCell(9), parsedData.threeWeeksAgoParsed.hourOfDayCounterObject, hour)
  this.setLoginsForHour(row.getCell(10), parsedData.twoWeeksAgoParsed.hourOfDayCounterObject, hour)
  this.setLoginsForHour(row.getCell(11), parsedData.oneWeeksAgoParsed.hourOfDayCounterObject, hour)
}

exports.printLoginsForCity = (cell, cityCounter, index) => {
  let city = cityCounter[index][0]
  const count = cityCounter[index][1]
  if (city === undefined || city === 'null') {
    city = 'Unknown'
  }
  this.setCell(cell, `${city}: ${count}`)
}

exports.printLoginsForCities = (row, parsedData, index) => {
  this.printLoginsForCity(row.getCell(8), parsedData.fourWeeksAgoParsed.cityCounter, index)
  this.printLoginsForCity(row.getCell(9), parsedData.threeWeeksAgoParsed.cityCounter, index)
  this.printLoginsForCity(row.getCell(10), parsedData.twoWeeksAgoParsed.cityCounter, index)
  this.printLoginsForCity(row.getCell(11), parsedData.oneWeeksAgoParsed.cityCounter, index)
}

exports.formatFromTo = (weeksAgo) => {
  const monday = dates.arbitraryMonday(weeksAgo + 1)
  const sunday = dates.arbitrarySunday(weeksAgo)
  return `${dateFormat(monday, 'mmm dd yyyy')} - ${dateFormat(sunday, 'mmm dd yyyy')}`
}

exports.printDateRanges = (rowNum) => {
  const row = sheet.getRow(rowNum)
  this.setHeaderCell(row.getCell(8), this.formatFromTo(4))
  this.setHeaderCell(row.getCell(9), this.formatFromTo(3))
  this.setHeaderCell(row.getCell(10), this.formatFromTo(2))
  this.setHeaderCell(row.getCell(11), this.formatFromTo(1))
}

exports.maxDayAndLogins = (loginsPerDayObject) => {
  const day = loginsPerDayObject[1][0]
  const logins = loginsPerDayObject[1][1]

  return `${dates.cookDay(Number(day))} - ${logins} Logins`
}

exports.maxHourAndLogins = (loginsPerHourObject) => {
  const hour = loginsPerHourObject[1][0]
  const logins = loginsPerHourObject[1][1]

  return `${dates.cookHour(hour)} - ${logins} Logins`
}

exports.maxDayHourAndLogins = (maxDayHourObject) => {
  return `${dates.cookDay(Number(maxDayHourObject.day))} ${dates.cookHour(maxDayHourObject.hour)} - ${maxDayHourObject.count} Logins`
}

exports.inRange = (range, date) => {
  return date >= range.start && date < range.end
}

exports.sortOnValues = (obj) => {
  const array = Object.keys(obj).map((key) => {
    return [key, obj[key]]
  })

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

  // console.log("obj: %j", dayOfWeekCounter)
  const dayOfWeekCounterObject = {}
  const hourOfDayCounterObject = {}
  return {
    dayOfWeekCounterObject: Object.assign(dayOfWeekCounterObject, dayOfWeekCounter),
    dayOfWeekCounter: this.sortOnValues(dayOfWeekCounter),
    maxDayHour: this.maxDayHour(hourOfDayPerDayCounter),
    hourOfDayCounterObject: Object.assign(hourOfDayCounterObject, hourOfDayCounter),
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
    return Promise.resolve({
      oneWeeksAgoParsed,
      twoWeeksAgoParsed,
      threeWeeksAgoParsed,
      fourWeeksAgoParsed,
      fiveWeeksAgoParsed
    })
  }).then((parsedData) => {
    // print Peak day hour day/hour
    let rowNum = 2
    oneWeeksAgoLogins.forEach(element => {
      const row = sheet.getRow(rowNum)
      const epoch = Date.parse(element.date)
      const date = new Date(epoch)
      row.values = [element.username, dates.formatEpoch(epoch), dates.cookDay(date.getDay()), element.city]
      sheet.getCell(`A${rowNum}`).border = border
      sheet.getCell(`B${rowNum}`).border = border
      sheet.getCell(`C${rowNum}`).border = border
      sheet.getCell(`D${rowNum}`).border = border

      rowNum++
    })

    return Promise.resolve(parsedData)
  }).then((parsedData) => {
    let row = sheet.getRow(1)
    this.setHeaderCell(row.getCell(7), '')
    this.setHeaderCell(row.getCell(8), 'TOTAL LOGINS')
    this.setHeaderCell(row.getCell(9), 'TOTAL LOGINS')
    this.setHeaderCell(row.getCell(10), 'TOTAL LOGINS')
    this.setHeaderCell(row.getCell(11), 'TOTAL LOGINS')
    row = sheet.getRow(2)
    this.setHeaderCell(row.getCell(7), 'PEAK')
    this.printDateRanges(2)

    row = sheet.getRow(3)
    this.setCell(row.getCell(7), 'DAY')
    this.setCell(row.getCell(8), this.maxDayAndLogins(parsedData.fourWeeksAgoParsed.dayOfWeekCounter))
    this.setCell(row.getCell(9), this.maxDayAndLogins(parsedData.threeWeeksAgoParsed.dayOfWeekCounter))
    this.setCell(row.getCell(10), this.maxDayAndLogins(parsedData.twoWeeksAgoParsed.dayOfWeekCounter))
    this.setCell(row.getCell(11), this.maxDayAndLogins(parsedData.oneWeeksAgoParsed.dayOfWeekCounter))

    row = sheet.getRow(4)
    this.setCell(row.getCell(7), 'HOUR')
    this.setCell(row.getCell(8), this.maxHourAndLogins(parsedData.fourWeeksAgoParsed.hourOfDayCounter))
    this.setCell(row.getCell(9), this.maxHourAndLogins(parsedData.threeWeeksAgoParsed.hourOfDayCounter))
    this.setCell(row.getCell(10), this.maxHourAndLogins(parsedData.twoWeeksAgoParsed.hourOfDayCounter))
    this.setCell(row.getCell(11), this.maxHourAndLogins(parsedData.oneWeeksAgoParsed.hourOfDayCounter))

    row = sheet.getRow(5)
    this.setCell(row.getCell(7), 'DAY/HOUR')
    this.setCell(row.getCell(8), this.maxDayHourAndLogins(parsedData.fourWeeksAgoParsed.maxDayHour))
    this.setCell(row.getCell(9), this.maxDayHourAndLogins(parsedData.threeWeeksAgoParsed.maxDayHour))
    this.setCell(row.getCell(10), this.maxDayHourAndLogins(parsedData.twoWeeksAgoParsed.maxDayHour))
    this.setCell(row.getCell(11), this.maxDayHourAndLogins(parsedData.oneWeeksAgoParsed.maxDayHour))

    return Promise.resolve(parsedData)
  }).then((parsedData) => {
    let row = sheet.getRow(8)
    this.setHeaderCell(row.getCell(7), '')
    this.setHeaderCell(row.getCell(8), 'TOTAL LOGINS')
    this.setHeaderCell(row.getCell(9), 'TOTAL LOGINS')
    this.setHeaderCell(row.getCell(10), 'TOTAL LOGINS')
    this.setHeaderCell(row.getCell(11), 'TOTAL LOGINS')
    row = sheet.getRow(9)
    this.setHeaderCell(row.getCell(7), '')
    this.printDateRanges(9)

    row = sheet.getRow(10)
    this.setCell(row.getCell(7), 'TOTAL')
    this.setCell(row.getCell(8), `${fourWeeksAgoLogins.length} `)
    this.setCell(row.getCell(9), `${threeWeeksAgoLogins.length} `)
    this.setCell(row.getCell(10), `${twoWeeksAgoLogins.length} `)
    this.setCell(row.getCell(11), `${oneWeeksAgoLogins.length} `)

    return Promise.resolve(parsedData)
  }).then((parsedData) => {
    let row = sheet.getRow(13)
    this.setHeaderCell(row.getCell(7), '')
    this.setHeaderCell(row.getCell(8), 'TOTAL LOGINS')
    this.setHeaderCell(row.getCell(9), 'TOTAL LOGINS')
    this.setHeaderCell(row.getCell(10), 'TOTAL LOGINS')
    this.setHeaderCell(row.getCell(11), 'TOTAL LOGINS')
    row = sheet.getRow(14)
    this.setHeaderCell(row.getCell(7), '')
    this.printDateRanges(14)

    parsedData.fourWeeksAgoParsed.dayOfWeekCounter.sort((a, b) => {
      return a[0] - b[0]
    })
    parsedData.threeWeeksAgoParsed.dayOfWeekCounter.sort((a, b) => {
      return a[0] - b[0]
    })
    parsedData.twoWeeksAgoParsed.dayOfWeekCounter.sort((a, b) => {
      return a[0] - b[0]
    })
    parsedData.oneWeeksAgoParsed.dayOfWeekCounter.sort((a, b) => {
      return a[0] - b[0]
    })

    row = sheet.getRow(15)
    this.setCell(row.getCell(7), 'Monday')
    this.printLoginsForDay(row, parsedData, 1)

    row = sheet.getRow(16)
    this.setCell(row.getCell(7), 'Tuesday')
    this.printLoginsForDay(row, parsedData, 2)

    row = sheet.getRow(17)
    this.setCell(row.getCell(7), 'Wednesday')
    this.printLoginsForDay(row, parsedData, 3)

    row = sheet.getRow(18)
    this.setCell(row.getCell(7), 'Thursday')
    this.printLoginsForDay(row, parsedData, 4)

    row = sheet.getRow(19)
    this.setCell(row.getCell(7), 'Friday')
    this.printLoginsForDay(row, parsedData, 5)

    row = sheet.getRow(20)
    this.setCell(row.getCell(7), 'Saturday')
    this.printLoginsForDay(row, parsedData, 6)

    row = sheet.getRow(21)
    this.setCell(row.getCell(7), 'Sunday')
    this.printLoginsForDay(row, parsedData, 0)

    return Promise.resolve(parsedData)
  }).then((parsedData) => {
    let row = sheet.getRow(24)
    this.setHeaderCell(row.getCell(7), '')
    this.setHeaderCell(row.getCell(8), 'TOTAL LOGINS')
    this.setHeaderCell(row.getCell(9), 'TOTAL LOGINS')
    this.setHeaderCell(row.getCell(10), 'TOTAL LOGINS')
    this.setHeaderCell(row.getCell(11), 'TOTAL LOGINS')
    row = sheet.getRow(25)
    this.setHeaderCell(row.getCell(7), '')
    this.printDateRanges(25)
    for (let i = 0; i < 24; i++) {
      row = sheet.getRow(i + 26)
      this.setCell(row.getCell(7), i)
      this.printLoginsForHourOfDay(row, parsedData, i)
    }
    return Promise.resolve(parsedData)
  }).then((parsedData) => {
    let row = sheet.getRow(52)
    this.setHeaderCell(row.getCell(7), 'TOP 10')
    this.setHeaderCell(row.getCell(8), 'TOP 10 CITIES TOTAL LOGINS')
    this.setHeaderCell(row.getCell(9), 'TOP 10 CITIES TOTAL LOGINS')
    this.setHeaderCell(row.getCell(10), 'TOP 10 CITIES TOTAL LOGINS')
    this.setHeaderCell(row.getCell(11), 'TOP 10 CITIES TOTAL LOGINS')
    row = sheet.getRow(53)
    this.setHeaderCell(row.getCell(7), 'CITIES')
    this.printDateRanges(53)

    for (let i = 0; i < 10; i++) {
      const row = sheet.getRow(i + 54)
      this.setCell(row.getCell(7), `${(i + 1)}`)
      this.printLoginsForCities(row, parsedData, i)
    }

    return Promise.resolve(parsedData)
  }).then((parsedData) => {
    let row = sheet.getRow(66)
    this.setHeaderCell(row.getCell(7), 'Last Week')
    this.setHeaderCell(row.getCell(8), 'LAST WEEK CITY MISSING IN')
    this.setHeaderCell(row.getCell(9), 'LAST WEEK CITY MISSING IN')
    this.setHeaderCell(row.getCell(10), 'LAST WEEK CITY MISSING IN')
    this.setHeaderCell(row.getCell(11), 'LAST WEEK CITY MISSING IN')
    row = sheet.getRow(67)
    this.setHeaderCell(row.getCell(7), 'CITY MISSING')
    this.printDateRanges(67)


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