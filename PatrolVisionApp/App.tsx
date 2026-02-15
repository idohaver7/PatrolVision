import React, { useState, useEffect } from 'react';
import { AppState, Platform, PermissionsAndroid, View, ActivityIndicator, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Camera } from 'react-native-vision-camera';

import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import PermissionBlocker from './src/components/PermissionBlocker';

function App() {
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkPermissions = async () => {
    try {
      // check camera permission
      const cameraStatus = await Camera.getCameraPermissionStatus();
      
      // check location permission (only needed for Android, iOS is handled via Info.plist)
      let locationGranted = true;
      if (Platform.OS === 'android') {
        locationGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
      }
      const isCameraOk = cameraStatus === 'granted';

      if (isCameraOk && locationGranted) {
        setHasPermissions(true);
      } else {
        setHasPermissions(false);
      }
    } catch (error) {
      console.error("Error checking permissions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkPermissions();
    
    // listen for app state changes to re-check permissions when the app becomes active again
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        checkPermissions();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  // if permissions are not granted, show the blocker screen
  if (!hasPermissions) {
    return <PermissionBlocker onCheckAgain={checkPermissions} />;
  }

  // if we have permissions, show the main app
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

export default App;