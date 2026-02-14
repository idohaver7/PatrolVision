import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StatusBar,
  Animated,
  PanResponder,
  Dimensions,
  PermissionsAndroid,
  Platform,
  Alert,
  AppState // חשוב: הוספנו את AppState כדי לפתור את הקריסה
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
// import ImageResizer from "@bam.tech/react-native-image-resizer"; // אם לא בשימוש כרגע, עדיף להשאיר בהערה
import Geolocation from 'react-native-geolocation-service';

import { analyzeTrafficFrame } from '../services/api';
import styles from './LiveCameraScreen.styles';
import { COLORS } from '../theme/colors';

// --- רכיב סליידר לסיום נסיעה ---
const SwipeButton = ({ onSwipeSuccess }) => {
  const [dragX] = useState(new Animated.Value(0));
  const sliderWidth = Dimensions.get('window').width * 0.85;
  const thumbSize = 50;
  const maxDrag = sliderWidth - thumbSize - 10;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0 && gestureState.dx <= maxDrag) {
          dragX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > maxDrag * 0.8) {
          Animated.timing(dragX, {
            toValue: maxDrag,
            duration: 200,
            useNativeDriver: false,
          }).start(() => onSwipeSuccess());
        } else {
          Animated.spring(dragX, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const textOpacity = dragX.interpolate({
    inputRange: [0, maxDrag / 2],
    outputRange: [1, 0],
    extrapolate: 'clamp'
  });

  return (
    <View style={[styles.sliderContainer, { width: sliderWidth }]}>
      <Animated.Text style={[styles.sliderText, { opacity: textOpacity }]}>
        Slide to End Trip
      </Animated.Text>
      <Animated.View
        style={[
          styles.sliderThumb,
          { transform: [{ translateX: dragX }] }
        ]}
        {...panResponder.panHandlers}
      >
        <Icon name="chevron-right" size={30} color="#000" />
      </Animated.View>
    </View>
  );
};

// --- המסך הראשי ---
const LiveCameraScreen = ({ navigation }) => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);
  const device = useCameraDevice('back');
  const insets = useSafeAreaInsets();

  const cameraRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const lastProcessTime = useRef(0);

  // נתוני מיקום ו-GPS
  const [currentLocation, setCurrentLocation] = useState(null);
  const locationRef = useRef(null);
  const [gpsStatus, setGpsStatus] = useState('searching'); // 'searching' | 'locked' | 'denied'
  const [speed, setSpeed] = useState(0); 

  // אנימציית REC
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. התחלת אנימציית הבהוב
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true })
      ])
    ).start();

    // 2. פונקציית אתחול הרשאות (ממתינה שהאפליקציה תהיה במצב פעיל)
    const initPermissions = async () => {
      // אם כבר יש הרשאה, רק נוודא שהמיקום עובד
      if (hasPermission) {
        setIsCheckingPermission(false);
        checkLocationPermission();
        return;
      }

      try {
        setIsCheckingPermission(true);
        const status = await requestPermission();
        
        // בדיקה גמישה לסטטוס (כי לפעמים זה סטרינג ולפעמים בוליאני)
        if (status === 'authorized' || status === 'granted' || status === true) {
          await checkLocationPermission();
        }
      } catch (err) {
        console.warn('Permission Error:', err);
      } finally {
        setIsCheckingPermission(false);
      }
    };

    // 3. האזנה לשינויי מצב אפליקציה כדי למנוע קריסת NO_ACTIVITY
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        initPermissions();
      }
    });

    // בדיקה ראשונית אם כבר פעיל
    if (AppState.currentState === 'active') {
      initPermissions();
    }

    // ניקוי ביציאה
    return () => {
      subscription.remove();
      Geolocation.stopObserving();
    };
  }, []); // תלות ריקה כדי שירוץ פעם אחת בטעינה

  // --- פונקציות עזר למיקום ---
  const checkLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          startLocationTracking();
        } else {
          setGpsStatus('denied');
          // אופציונלי: התראה למשתמש
          // Alert.alert("שגיאה", "נדרשת גישה למיקום");
        }
      } catch (err) {
        console.warn(err);
      }
    } else {
      startLocationTracking();
    }
  };

  const startLocationTracking = () => {
    setGpsStatus('searching');
    Geolocation.watchPosition(
      (position) => {
        setGpsStatus('locked');
        const newLoc = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        setCurrentLocation({newLoc});
        locationRef.current = newLoc;

        if (position.coords.speed && position.coords.speed > 0) {
          setSpeed(Math.round(position.coords.speed * 3.6));
        } else {
          setSpeed(0);
        }
      },
      (error) => {
        console.log("GPS Error:", error.code, error.message);
        setGpsStatus('searching');
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 5,
        interval: 3000,
        fastestInterval: 2000
      }
    );
  };

  // --- עיבוד תמונה ---
  const processFrame = async () => {
    const now = Date.now();
    // Rate limiting: בדיקה כל שניה
    if (!cameraRef.current || isProcessing || (now - lastProcessTime.current < 1000)) return;

    try {
      setIsProcessing(true);
      lastProcessTime.current = now;

      // צילום תמונה מהירה
      const photo = await cameraRef.current.takePhoto({
        qualityPrioritization: 'speed',
        flash: 'off'
      });

      // כרגע מדלגים על כיווץ (אפשר להחזיר בהמשך)
      const resized = { uri: 'file://' + photo.path }; 

      // שליחה לשרת
      const result = await analyzeTrafficFrame(resized.uri);

      // זיהוי עבירה
      if (result.success && result.data.violation_detected) {
        console.log("🚨 VIOLATION FOUND:", result.data.type);
        const locationToSend = locationRef.current || { latitude: 0, longitude: 0 };
        console.log("📍 Sending Location:", locationToSend);

        navigation.navigate('NewViolation', {
          violationType: result.data.type,
          plate: result.data.details?.plate,
          imageUri: 'file://' + photo.path,
          // שליחת המיקום האחרון שנשמר
          location: locationToSend || { latitude: 0, longitude: 0 } 
        });
      }
    } catch (err) {
      console.log("Processing Error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // טיימר לעיבוד תמונות
  useEffect(() => {
    const interval = setInterval(() => {
      processFrame();
    }, 1000);

    return () => clearInterval(interval);
  }, [isProcessing, currentLocation]); // תלויות מעודכנות

  // --- יציאה מהמסך ---
  const handleEndTrip = () => {
    Geolocation.stopObserving();
    navigation.goBack();
  };

  // צבע לאייקון ה-GPS
  const getGpsIconColor = () => {
    if (gpsStatus === 'locked') return '#4CAF50';
    if (gpsStatus === 'denied') return '#F44336';
    return '#FFC107';
  };

  // --- UI ---
  // מסך טעינה יפה יותר במקום סתם ספינר
  if (isCheckingPermission) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FFF" />
        <Text style={{ color: 'white', marginTop: 10 }}>Checking Permissions...</Text>
      </View>
    );
  }
  
  if (!hasPermission) return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{color: 'white'}}>No Camera Permission</Text>
      </View>
  );
  
  if (device == null) return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{color: 'white'}}>No Camera Device Found</Text>
      </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <Camera
        ref={cameraRef}
        style={styles.camera}
        device={device}
        isActive={true}
        photo={true}
      />

      {/* --- Top Bar --- */}
      <View style={[styles.topBar, { top: insets.top + 10 }]}>
        {/* מחוון הקלטה */}
        <View style={styles.recContainer}>
          <Animated.View style={[styles.recDot, { opacity: fadeAnim }]} />
          <Text style={styles.recText}>REC</Text>
        </View>

        {/* מחוון GPS ומהירות */}
        <View style={styles.gpsContainer}>
          <Text style={styles.speedText}>{speed} km/h</Text>
          <Icon name="gps-fixed" size={20} color={getGpsIconColor()} style={{ marginLeft: 8 }} />
        </View>
      </View>

      {/* --- Bottom Slider --- */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 20 }]}>
        <SwipeButton onSwipeSuccess={handleEndTrip} />
      </View>
    </View>
  );
};

export default LiveCameraScreen;