'use strict'

exports.handler = event => {
  // eslint-disable-next-line
  console.log(`${JSON.stringify(event)}`);

  let pageToken = event.page_token
  if (pageToken === '') {
    pageToken = undefined
  }

  // const jobId = __webpack_require__(57)();

  return true;
  // return findUsers(jobId, pageToken).then(response => {
  //   return { find_users: response };
  // }).catch(error => {
  //   // eslint-disable-next-line
  //   console.error('Error finding users', error);
  //   throw error;
  // });
}

// const findUsers = (jobId, paginationToken) => {
//   var listUsersParams = {
//     UserPoolId: process.env.USER_POOL_ID,
//     AttributesToGet: ['email'],
//     Limit: 60
//   };
//   if (paginationToken !== undefined) {
//     listUsersParams.PaginationToken = paginationToken;
//   }
//   const cognitoidentityserviceprovider = new _awsSdk2.default.CognitoIdentityServiceProvider({ apiVersion: '2016-04-18', region: process.env.REGION });

//   const confirmedUsers = [];
//   const nonConfirmedUsers = [];
//   return cognitoidentityserviceprovider.listUsers(listUsersParams).promise().then(response => {
//     response.Users.forEach(user => {
//       if (user.UserStatus === 'CONFIRMED') {
//         // eslint-disable-next-line
//         console.log(`Found confirmed user ${user.Username}`);
//         confirmedUsers.push(user);
//       } else if (process.env.LIST_NON_CONFIRMED_USERS === 'true') {
//         // eslint-disable-next-line
//         console.log(`Found non confirmed user ${user.Username}`);
//         nonConfirmedUsers.push(user);
//       }
//     });

//     const nextPageToken = response.PaginationToken === undefined ? 'NONE' : response.PaginationToken;
//     return Promise.resolve({
//       confirmed_users: confirmedUsers,
//       non_confirmed_users: nonConfirmedUsers,
//       total_users: confirmedUsers.length + nonConfirmedUsers.length,
//       next_page_token: nextPageToken });
//   }).catch(error => {
//     if (error.code === 'TooManyRequestsException') {
//       // eslint-disable-next-line
//       console.error(`TooManyRequestsException for page token ${paginationToken} with error ${JSON.stringify(error)}`);

//       return (0, _sleep.sleep)(Math.random() * 1000).then(() => {
//         return findUsers(jobId, paginationToken);
//       });
//     } else {
//       // eslint-disable-next-line
//       console.error('Error while listing users', error);
//       throw error;
//     }
//   });
// };
