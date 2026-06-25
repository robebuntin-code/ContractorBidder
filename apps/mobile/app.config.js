/** @type {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE ?? '';
  // Dev client only for development builds — production/preview are standalone apps.
  const useDevClient =
    process.env.EXPO_DEV_CLIENT === '1' ||
    profile === 'development' ||
    profile === 'development-simulator';

  return {
    ...config,
    name: 'DOJOBID',
    slug: 'contractor-bidder',
    scheme: 'contractorbidder',
    version: '0.1.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    icon: './assets/icon.png',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.contractorbidder.app',
      infoPlist: {
        NSPhotoLibraryUsageDescription: 'Allow DOJOBID to attach photos to your job posts.',
        NSLocationWhenInUseUsageDescription: 'Used to center the job map near you.',
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'com.contractorbidder.app',
      adaptiveIcon: {
        foregroundImage: './assets/icon.png',
        backgroundColor: '#0D203A',
      },
      permissions: [
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.RECORD_AUDIO',
      ],
    },
    web: {
      bundler: 'metro',
      favicon: './assets/icon.png',
    },
    plugins: [
      ...(useDevClient ? ['expo-dev-client'] : []),
      [
        'expo-location',
        {
          locationWhenInUsePermission: 'DOJOBID uses your location to find jobs near you.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow DOJOBID to attach photos to your job posts.',
        },
      ],
      'expo-notifications',
      '@react-native-community/datetimepicker',
      [
        'expo-splash-screen',
        {
          image: './assets/logo.png',
          imageWidth: 240,
          resizeMode: 'contain',
          backgroundColor: '#F5F7F7',
        },
      ],
    ],
    extra: {
      apiUrl:
        process.env.EXPO_PUBLIC_API_URL ??
        'https://dojobid-api-production.up.railway.app/api/v1',
      eas: {
        projectId: 'b207fc9c-5de2-4d6e-a471-44379207cbac',
      },
    },
    owner: 'robebuntin',
  };
};
