import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  Image, 
  StyleSheet, 
  Vibration, // לייצור רטט כהתראה
  StatusBar
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { reportViolation } from '../services/api';
import { useAuth } from '../context/AuthContext'; 
import styles from './NewViolationScreen.styles';
import { COLORS } from '../theme/colors';

const NewViolationScreen = ({ route, navigation }) => {
  // קבלת הנתונים ממסך המצלמה
  const { violationType, plate, imageUri, location } = route.params;
  const { token } = useAuth();

  // יצירת תאריך נוכחי לתצוגה
  const timestamp = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: 'numeric', hour12: true
  });

  useEffect(() => {
    const handleViolationProcess = async () => {
      // 1. נסיון להפעיל רטט - מוגן מקריסה
      try {
        Vibration.vibrate([0, 500, 200, 500]); 
      } catch (err) {
        console.warn("Vibration failed:", err);
        // אנחנו לא רוצים שהאפליקציה תקרוס בגלל זה
      }

      // 2. שליחת הדיווח
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
        // אם הפונקציה הזו קורסת, היא תיתפס ב-catch למטה
        await reportViolation(token, reportData); 
      } catch (error) {
        console.error("Failed to auto-report:", error);
      }
    };

    handleViolationProcess();

    // 3. טיימר לחזרה
    const timer = setTimeout(() => {
      // בדיקה שהניווט עדיין אפשרי (למנוע קריסה אם המשתמש כבר יצא)
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      
      {/* אייקון אזהרה אדום */}
      <View style={{ marginBottom: 20 }}>
        <Icon name="report-problem" size={60} color="#FF0000" />
      </View>

      <Text style={styles.title}>Violation Detected</Text>

      {/* תצוגת התמונה שנתפסה */}
      <View style={styles.imageContainer}>
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
      </View>

      {/* פרטי העבירה בעיצוב נקי */}
      <View style={styles.detailsContainer}>
        <Text style={styles.violationType}>{violationType}</Text>
        
        <Text style={styles.plateNumber}>
           {plate ? `Plate: ${plate}` : 'Plate: Unidentified'}
        </Text>

        <View style={styles.locationRow}>
          <Icon name="location-on" size={20} color="#ccc" />
          <Text style={styles.locationText}>
            {/* כאן אפשר להכניס כתובת אם יש geocoding, כרגע נציג קואורדינטות או טקסט קבוע */}
            {location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'Location Unavailable'}
          </Text>
        </View>

        <Text style={styles.timestamp}>{timestamp}</Text>
      </View>

    </View>
  );
};

export default NewViolationScreen;