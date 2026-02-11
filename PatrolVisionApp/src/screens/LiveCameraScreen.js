import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, Linking, Button, TouchableOpacity, StatusBar } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ImageResizer from "@bam.tech/react-native-image-resizer"; 
import Geolocation from 'react-native-geolocation-service';

import { analyzeTrafficFrame } from '../services/api';
import styles from './LiveCameraScreen.styles';
import { COLORS } from '../theme/colors';

const LiveCameraScreen = ({ navigation }) => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);
  const device = useCameraDevice('back');
  const insets = useSafeAreaInsets();

  const cameraRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const lastProcessTime = useRef(0); 

  const [currentLocation, setCurrentLocation] = useState(null);

  // check and request camera permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      setIsCheckingPermission(true);
      await requestPermission();
      // Also request location permission
      await requestLocationPermission();
      setIsCheckingPermission(false);
    };
    checkPermission();
  }, [requestPermission]);

  // Request location permission
  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          // Permission granted
          startLocationTracking();
        }
      } catch (err) {
        console.warn(err);
      }
    }
  };
  // Start tracking location
  const startLocationTracking = () => {
    Geolocation.watchPosition(
      (position) => {
        // Update current location state
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        console.log("GPS Error:", error.code, error.message);
      },
      { enableHighAccuracy: true, distanceFilter: 10, interval: 5000 }
    );
  };

//global function to process frames periodically
  const processFrame = async () => {
    // Rate limiting: process only if not already processing and at least 1 second since last
    const now = Date.now();
    if (!cameraRef.current || isProcessing || (now - lastProcessTime.current < 1000)) return;

    try {
      setIsProcessing(true);
      lastProcessTime.current = now;

      // 1. Capture photo from camera
      const photo = await cameraRef.current.takePhoto({
        qualityPrioritization: 'speed',
        flash: 'off'
      });

      // 2. Resize the image to reduce upload size
      // const resized = await ImageResizer.createResizedImage(
      //   photo.path,
      //   1280, 720, 'JPEG', 70, 0
      // );
      const resized = { uri: 'file://' + photo.path }; // Skip resizing for now

      // 3. Send to server for analysis
      const result = await analyzeTrafficFrame(resized.uri);

      // 4. If violation detected, navigate to NewViolationScreen
      if (result.success && result.data.violation_detected) {
        console.log("🚨 VIOLATION FOUND:", result.data.type);
        
        // Navigate to NewViolationScreen with details
        navigation.navigate('NewViolation', {
          violationType: result.data.type,
          plate: result.data.details?.plate, // catch plate if available
          imageUri: 'file://' + photo.path, // send original image path
          location: currentLocation || { latitude: 0, longitude: 0 } // use current location or fallback
        });
      }

    } catch (err) {
      console.log("Processing Error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Set up interval to process frames every second
  useEffect(() => {
    const interval = setInterval(() => {
       // Call the frame 
       processFrame();
    }, 1000); 

    return () => clearInterval(interval);
  }, [isProcessing]); 

 
  if (isCheckingPermission) return <ActivityIndicator size="large" />;
  if (!hasPermission) return <Text>No Permission</Text>;
  if (device == null) return <Text>No Device</Text>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <Camera
        ref={cameraRef} 
        style={styles.camera}
        device={device}
        isActive={true} // allways active when on this screen
        photo={true}    // enable photo capture
      />

      {/* Overlay UI */}
      <View style={{position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 5, borderRadius: 5}}>
          <Text style={{color: 'white', fontSize: 12}}>
            {isProcessing ? "Analyzing..." : "Scanning for violations"}
          </Text>
      </View>

      <View style={styles.overlayContainer}>
        <TouchableOpacity style={[styles.closeButton, { top: insets.top + 10 }]} onPress={() => navigation.goBack()}>
          <Icon name="close" size={24} color={COLORS.surface} />
        </TouchableOpacity>
      </View>  
    </View>
  );
};

export default LiveCameraScreen;