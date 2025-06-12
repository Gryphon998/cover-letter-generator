// amplify.js
const { Amplify, Auth, Storage } = window.aws_amplify;

Amplify.configure({
    Auth: {
      region: 'us-east-1',
      identityPoolId: 'us-east-1:3726be12-10b3-41f5-8d8a-6ba75171e8eb',
      userPoolId: 'us-east-1_Y9vo1V9OU',
      userPoolWebClientId: '156rthlibtmbhtm7sk9atq6ous'
    },
    Storage: {
      AWSS3: {
        bucket: 'resume-storage-demo',
        region: 'us-east-1',
        level: 'private'
      }
    }
  });