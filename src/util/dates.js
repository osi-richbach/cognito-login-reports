exports.dayOfWeek = (date) => {
  const day = date.getDay()
  let cookedDay
  switch (day) {
    case 0:
      cookedDay = 'Sunday'
      break
    case 1:
      cookedDay = 'Monday'
      break
    case 2:
      cookedDay = 'Tuesday'
      break
    case 3:
      cookedDay = 'Wednesday'
      break
    case 4:
      cookedDay = 'Thursday'
      break
    case 5:
      cookedDay = 'Friday'
      break
    case 6:
      cookedDay = 'Saturday'
      break
    default:
      throw new Error('Unknown day')
  }
  return cookedDay
}

exports.cookDay = (day) => {
  let cookedDay
  switch (day) {
    case 0:
      cookedDay = 'Sunday'
      break
    case 1:
      cookedDay = 'Monday'
      break
    case 2:
      cookedDay = 'Tuesday'
      break
    case 3:
      cookedDay = 'Wednesday'
      break
    case 4:
      cookedDay = 'Thursday'
      break
    case 5:
      cookedDay = 'Friday'
      break
    case 6:
      cookedDay = 'Saturday'
      break
    default:
      throw new Error(`Unknown day ${day}`)
  }
  return cookedDay
}

exports.monday5WeeksAgo = () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(today.setDate(diff - 35))
}

exports.mondayLastWeek = () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(today.setDate(diff - 7))
}

exports.recentSunday = () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(today.setDate(diff - 1))
}

exports.mondayThisWeek = () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(today.setDate(diff))
}

exports.formatEpoch = (epoch) => {
  const thedate = new Date()
  thedate.setTime(epoch)

  let month = thedate.getMonth() + 1
  if (month < 10) month = `0${month}`

  let date = thedate.getDate()
  if (date < 10) date = `0${date}`

  let hours = thedate.getHours()
  if (hours < 10) hours = `0${hours}`

  let minutes = thedate.getMinutes()
  if (minutes < 10) minutes = `0${minutes}`

  return `${thedate.getFullYear()}-${month}-${date} ${hours}:${minutes}`
}

exports.formatEpoch = (epoch) => {
  const thedate = new Date()
  thedate.setTime(epoch)

  let month = thedate.getMonth() + 1
  if (month < 10) month = `0${month}`

  let date = thedate.getDate()
  if (date < 10) date = `0${date}`

  let hours = thedate.getHours()
  if (hours < 10) hours = `0${hours}`

  let minutes = thedate.getMinutes()
  if (minutes < 10) minutes = `0${minutes}`

  return `${thedate.getFullYear()}-${month}-${date} ${hours}:${minutes}`
}

