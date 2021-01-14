'use strict'
const AWS = require('aws-sdk')
// const fs = require('fs')
const path = require('path')
const nodemailer = require('nodemailer')

const s3 = new AWS.S3()
const ses = new AWS.SES()

exports.handler = event => {
  // eslint-disable-next-line
  console.log(`${JSON.stringify(event)}`);

  const filedata = {}
  return downloadFile(event.failed_logins_filename)
    .then((data) => {
      filedata.failed_logins_file = data.Body
      return downloadFile(event.no_recent_login_filename)
    }).then((data) => {
      filedata.no_recent_login_file = data.Body
      return downloadFile(event.successful_logins_filename)
    }).then((data) => {
      filedata.successful_logins_file = data.Body
      return sendEmail(event, filedata)
    }).then((data) => {
      console.log('EMAIL HAS BEEN SENT')
      console.log(data)
      return Promise.resolve(true)
    }).catch(error => {
      // eslint-disable-next-line
      console.error('Error Sending Reports', error);
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

const sendEmail = (event, filedata) => {
  const mailOptions = {
    from: 'ken.hamilton@osi.ca.gov',
    subject: 'Weekly Login Report',
    html: '<p>Hi Khosrow,<br/>Attached are last week\'s login reports.<br/>Thanks.</p>',
    to: process.env.EMAIL_TO,
    attachments: [
      {
        filename: `${path.basename(event.failed_logins_filename)}`,
        content: filedata.failed_logins_file
      },
      {
        filename: `${path.basename(event.no_recent_login_filename)}`,
        content: filedata.no_recent_login_file
      },
      {
        filename: `${path.basename(event.successful_logins_filename)}`,
        content: filedata.successful_logins_file
      }
    ]
  }

  console.log(mailOptions)

  // create Nodemailer SES transporter
  const transporter = nodemailer.createTransport({
    SES: ses
  })

  // send email
  return transporter.sendMail(mailOptions)
}
