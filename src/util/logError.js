const AWS = require('aws-sdk')

exports.logError = (lambda, jobId, message, error) => {
  const publishMessage = {
    lambda: lambda,
    message: message,
    jobId: jobId,
    error: error.toString()
  }

  const params = {
    Message: JSON.stringify(publishMessage),
    TopicArn: process.env.FIND_USERS_DLQ_TOPIC_ARN
  }
  const sns = new AWS.SNS()
  // send and move on
  sns.publish(params).promise().then(() => {}).catch(error => {
    // eslint-disable-next-line
    console.error(`Error logging error for ${lambda} - ${jobId} - ${message} - ${error}`, error);
  })
}
