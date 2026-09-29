/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    ...require('./app.json').expo,
    android: {
      usesCleartextTraffic: true,
    },
  },
};
