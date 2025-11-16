import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Linking, Button,TouchableOpacity,StatusBar } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission, // Hook for permissions
} from 'react-native-vision-camera';
import styles from './LiveCameraScreen.styles';
import { COLORS } from '../theme/colors';
import { useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

const LiveCameraScreen = ({navigation}) => {
  // 1. Hook to manage camera permission
  const { hasPermission, requestPermission } = useCameraPermission();
  
  // 2. State to know if we are checking permission
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);

  // 3. Find the best available camera device (e.g., back camera)
  const device = useCameraDevice('back');

  const insets = useSafeAreaInsets();
  // 4. Run this effect when the screen loads
  useEffect(() => {
    const checkPermission = async () => {
      setIsCheckingPermission(true);
      const status = await requestPermission(); // Request permission
      setIsCheckingPermission(false);
    };
    checkPermission();
  }, [requestPermission]); // Dependency array
  const handleClose = () => {
    navigation.goBack();
  };
  // 5. Handle different UI states

  // State 1: Still checking permissions
  if (isCheckingPermission) {
    return (
      <View style={styles.messageContainer}>
        <ActivityIndicator size="large" color={COLORS.surface} />
        <Text style={styles.messageText}>Checking permissions...</Text>
      </View>
    );
  }

  // State 2: Permission was denied
  if (!hasPermission) {
    return (
      <View style={styles.messageContainer}>
        <Text style={styles.messageText}>Camera permission is required to use the dashcam.</Text>
        {/* Button to open app settings */}
        <Button title="Open Settings" onPress={() => Linking.openSettings()} />
      </View>
    );
  }

  // State 3: No camera device found
  if (device == null) {
    return (
      <View style={styles.messageContainer}>
        <Text style={styles.messageText}>No camera device found.</Text>
      </View>
    );
  }

  // State 4: Everything is good! Show the camera
  return (
    <View style={styles.container}>
      <StatusBar //set status bar to transparent
        barStyle="light-content" 
        translucent={true}
        backgroundColor="transparent"
      />
      <Camera
        style={styles.camera}
        device={device}
        isActive={true} // Start the camera
      />
    <View style={styles.overlayContainer}>
        <TouchableOpacity style={[styles.closeButton, { top: insets.top + 10 }]}
          onPress={handleClose}
        >
          <Icon name="close" size={24} color={COLORS.surface} />
        </TouchableOpacity>
        </View>  
    </View>
  );
};

export default LiveCameraScreen;