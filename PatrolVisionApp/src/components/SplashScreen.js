// src/components/SplashScreen.js
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { COLORS } from '../theme/colors';

const SplashScreen = () => {
  //beginning of animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;  
  const scaleAnim = useRef(new Animated.Value(0.5)).current; 

  useEffect(() => {
    //start parallel animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, 
        duration: 1000, 
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5, 
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.logoContainer, 
          { 
            opacity: fadeAnim, 
            transform: [{ scale: scaleAnim }] 
          }
        ]}
      >
        {/* Logo Icon & Text */}
        <Icon name="directions-car" size={120} color={COLORS.primary} />
        <Text style={styles.text}>PatrolVision</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', 
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  text: {
    fontSize: 40, 
    fontWeight: 'bold',
    color: COLORS.primary, 
    marginTop: 20,
    letterSpacing: 2, 
  },
});

export default SplashScreen;