import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  Image,  
  Vibration, 
  StatusBar
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { reportViolation } from '../services/api';
import { useAuth } from '../context/AuthContext'; 
import styles from './NewViolationScreen.styles';


const NewViolationScreen = ({ route, navigation }) => {
  // Accessing violation details passed from LiveCameraScreen
  const { violationType, plate, imageUri, location,onReturnId } = route.params|| {};
  const { token } = useAuth();

  // Timestamp formatting
  const timestamp = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: 'numeric', hour12: true
  });

useEffect(() => {
    let isMounted = true;

    const handleViolationProcess = async () => {
      try {
        Vibration.vibrate([0, 500, 200, 500]); 
      } catch (err) {
        console.warn("Vibration failed:", err);
      }

      //Timer
      const timerPromise = new Promise(resolve => setTimeout(resolve, 3000));// 3 seconds timer to allow user to see the violation details before navigating away

      // sent the violation report
      const reportData = {
        violationType,
        licensePlate: plate || 'Unidentified',
        imageUri,
        latitude: location?.latitude || 0,
        longitude: location?.longitude || 0,
        timestamp: new Date().toISOString()
      };

      let violationId = null;

      try {
        console.log("Auto-reporting violation...", reportData);
        const result = await reportViolation(token, reportData);
        
        if (result.success && result.data?.data?._id) {
          violationId = result.data.data._id;
          console.log("New_Violation reported successfully, server ID:", violationId);
        }
      } catch (error) {
        console.error("Failed to auto-report:", error);
      }

      
      await timerPromise;

      if (!isMounted) return;

      if (onReturnId ) {
        onReturnId( violationId || null );
      }
      // Navigate back to the previous screen  after processing
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    };

    handleViolationProcess();
    return () => { isMounted = false; };
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      
      {/* Red warning icon */}
      <View style={{ marginBottom: 20 }}>
        <Icon name="report-problem" size={60} color="#FF0000" />
      </View>

      <Text style={styles.title}>Violation Detected</Text>

      {/* image */}
      <View style={styles.imageContainer}>
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
      </View>

      {/* violation details */}
      <View style={styles.detailsContainer}>
        <Text style={styles.violationType}>{violationType}</Text>
        
        <Text style={styles.plateNumber}>
           {plate ? `Plate: ${plate}` : 'Plate: Unidentified'}
        </Text>

        <View style={styles.locationRow}>
          <Icon name="location-on" size={20} color="#ccc" />
          <Text style={styles.locationText}>
            {/* Here it will show the location coordinates */}
            {location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'Location Unavailable'}
          </Text>
        </View>

        <Text style={styles.timestamp}>{timestamp}</Text>
      </View>

    </View>
  );
};

export default NewViolationScreen;