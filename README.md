# Cognito Login Reports 

The [Cognito Login Reports](https://github.com/ca-cwds/cognito-login-reports) project contains AWS Step Functions which generate cognito login reports.  There are 3 reports which are generated:

* No Recent Logins - This is a report of user ids which have not logged in during the last 30 days.
* Failed Logins - This is a report of failed logins over the previous week.
* Login Report - This is a report of successful logins over the previous week.  There are some rolled up calculations that are included with this report.  eg.  Logins per hour of the day, logins per day, etc.

The reports are run every Monday morning at 8:00 GMT.  An email is sent to Khosrow containing the files.

## Getting Started

### Prerequisites
* [GIT](https://git-scm.com/) - Source Control
* [Node 12.x](https://nodejs.org/en/) - The serverless framework is a node package.
* [Serverless Framework](https://www.serverless.com/) - An opensource framework for developing applications and microservices on [AWS Lambda](https://aws.amazon.com/lambda/).

The instructions below will guide you through setting up a local development environment on a **MAC**.  

These instructions do not include installation of a IDE or editor.  I use [VS Code](https://code.visualstudio.com/), however, feel free to use whatever you are comfortable with and makes you the most efficient.

## Instructions

1. **Install GIT**
	
	You most likely already have GIT install on your machine but if you do not, follow the instructions [here](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git).
	 
1. **Install Node Version Manager**

   I use [nvm](https://github.com/nvm-sh/nvm) for managing different Node environments.  The instructions in the link above say that installing via [brew](https://formulae.brew.sh/formula/nvm) is not supported, however, I did it and have not had any issues.
   
   `$ brew install nvm`
   
1. **Install and use Node >= 12**

	   I'm using **14.16** so let's continue with that.
	   
   
   ```
   $ nvm install 14.16
   $ nvm use 14.16 
   ```

1. **Globally install Serverless 2.28.0**

   `$ npm install -g serverless@2.28.0`

At this point your machine should be setup for local development.  	

## Local Development

### Setup

Please see the prerequisites in above if you have not already done so.

1. **Check out this repository**

	`$ git clone https://github.com/ca-cwds/cognito-login-reports`
	
1. **Change to directoy where you clone the repository**

	`$ cd /path/to/repository`
	
1. **Setup the node environment**	
	
	`npm install`

## Running Locally

This project makes heavy use of [AWS Step Functions](https://aws.amazon.com/step-functions/).  

While there are serverless framework plugins for running step functions locally, I have not had much success with them.  Instead I have relied on running individual lambda functions locally.
		
1. **Running a function locally**

	`serverless invoke local -f FUNCTION_NAME --path PATH_TO_PAYLOAD`
	
	Where **FUNCTION_NAME** is the name of the function in [serverless.yml](./serverless.yml) and **PATH_TO_PAYLOAD** is the path to a file containing the json payload the lambda function is to process.

	
## Deployment

To deploy the step functions, make sure you have the correct AWS keys setup.

`serverless deploy --stage prod --region us-west-2`

If you want to deploy the dev version for testing...

`serverless deploy --stage dev --region us-west-2`	
## Report Email
The email recepients are defined in [serverless.yml](./serverless.yml)

```
custom:
  dev:
    userPoolId: us-west-2_xxxxxxx
    emailTo: "ken.hamilton@osi.ca.gov"
    reports-bucket-name: cwds.cognito.userlist
  prod:
    userPoolId: us-west-2_xxxxxxx 
    emailTo: "ken.hamilton@osi.ca.gov, khosrow.mamnoon@osi.ca.gov"
    reports-bucket-name: weeklyloginreports20xx
```
	
## Issues
1. The cognito authentication flow includes an oddity where each successful login appears as 2 logins in the Cognito audit log (please do not ask the reason...long story).  One login shows up from the AWS Lambda infrastructure.  The other is the actual login by the user.  Our report **attempts** to filter the AWS Lambda login out of the report.

This code is in [processConfirmedUsers.js](./src/processConfirmedUsers.js).

```
const isSuccessfulUserLogin = authEvent => {
  // This really is horrible. 'Unknown, Unknown' seems to be best way to figure out the "fake" login
  console.log(JSON.stringify(authEvent))
  if (authEvent.EventType === 'SignIn' && authEvent.EventResponse === 'Pass' && (authEvent.EventContextData.IpAddress !== '34.223.204.222' && authEvent.EventContextData.DeviceName !== 'Unknown, Unknown' && authEvent.EventContextData.City !== 'Boardman')) {
    return true
  }

  return false
}
```

AWS consistently changes the "look" of the "fake" login and so we at times do not filter all of them.  Updating this code based on the new criteria and rerunning will correct.	
	