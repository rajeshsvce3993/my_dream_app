/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    ...require('./app.json').expo,
    plugins: [
      'expo-router',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Allow Dream Food to use your location to fill delivery address and find nearby restaurants.',
          isAndroidBackgroundLocationEnabled: false,
          isIosBackgroundLocationEnabled: false,
        },
      ],
    ],
    ios: {
      backgroundColor: '#0F2430',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Allow Dream Food to use your location to fill delivery address and find nearby restaurants.',
      },
    },
    android: {
      backgroundColor: '#0F2430',
      usesCleartextTraffic: true,
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
    },
  },
};
