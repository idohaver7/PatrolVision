import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  Image, 
  StyleSheet, 
  Vibration, 
  StatusBar
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { reportViolation } from '../services/api';
import { useAuth } from '../context/AuthContext'; 
import styles from './NewViolationScreen.styles';
import { COLORS } from '../theme/colors';

const NewViolationScreen = ({ route, navigation }) => {
  // Accessing violation details passed from LiveCameraScreen
  const { violationType, plate, imageUri, location } = route.params;
  const { token } = useAuth();

  // Timestamp formatting
  const timestamp = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: 'numeric', hour12: true
  });

  useEffect(() => {
    const handleViolationProcess = async () => {
      // Vibration pattern: vibrate for 500ms, pause for 200ms, then vibrate for another 500ms
      try {
        Vibration.vibrate([0, 500, 200, 500]); 
      } catch (err) {
        console.warn("Vibration failed:", err);
      }

      // Auto-reporting the violation to the backend
      const reportData = {
        violationType,
        licensePlate: plate || null,
        imageUri,
        latitude: location?.latitude || 0,
        longitude: location?.longitude || 0,
        timestamp: new Date().toISOString()
      };

      try {
        console.log("🚀 Auto-reporting violation...", reportData);
        await reportViolation(token, reportData); 
      } catch (error) {
        console.error("Failed to auto-report:", error);
      }
    };

    handleViolationProcess();

    // Auto-navigate back to LiveCameraScreen after 5 seconds
    const timer = setTimeout(() => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    }, 5000);

    return () => clearTimeout(timer);
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