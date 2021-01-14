'use strict'
const AWS = require('aws-sdk')
const fs = require('fs')
const path = require('path')
const nodemailer = require('nodemailer')

const s3 = new AWS.S3()
const ses = new AWS.SES()

exports.handler = event => {
  // eslint-disable-next-line
  console.log(`${JSON.stringify(event)}`);

  return downloadFile(event.failed_logins_filename)
    .then((data) => {
      console.log(path.basename(event.failed_logins_filename))
      fs.writeFileSync(`/tmp/${path.basename(event.failed_logins_filename)}`, data.Body)
      console.log(`${event.failed_logins_filename} downloaded successfully`)
      return Promise.resolve(true)
    }).then(() => {
      return downloadFile(event.no_recent_login_filename)
    }).then((data) => {
      console.log(path.basename(event.no_recent_login_filename))
      fs.writeFileSync(`/tmp/${path.basename(event.no_recent_login_filename)}`, data.Body)
      console.log(`${event.no_recent_login_filename} downloaded successfully`)
      return Promise.resolve(true)
    }).then(() => {
      return downloadFile(event.successful_logins_filename)
    }).then((data) => {
      console.log(path.basename(event.successful_logins_filename))
      fs.writeFileSync(`/tmp/${path.basename(event.successful_logins_filename)}`, data.Body)
      console.log(`${event.successful_logins_filename} downloaded successfully`)
      return Promise.resolve(true)
    }).then(() => {
      return sendEmail()
    }).then(() => {
      console.log('EMAIL HAS BEEN SENT')
      return Promise.resolve(true)
    }).catch(error => {
      // eslint-disable-next-line
      console.error('Error finding users', error);
      throw error
    })
}

const downloadFile = (key) => {
  const params = {
    Key: key,
    Bucket: process.env.REPORTS_BUCKET_NAME
  }
  return s3.getObject(params).promise()
}

const sendEmail = () => {
  const mailOptions = {
    from: 'ken.hamilton@osi.ca.gov',
    subject: 'Weekly Login Report',
    html: '<p>Hi Khosrow,<br/>Attached are last week\'s login reports.<br/>Thanks.</p>',
    to: 'rich.bach@osi.ca.gov',
    attachments: [
    {
        filename: "An Attachment.pdf",
        content: fileData.Body
    }
]
  }

  // create Nodemailer SES transporter
  const transporter = nodemailer.createTransport({
    SES: ses
  })

  // send email
  return transporter.sendMail(mailOptions)
}
