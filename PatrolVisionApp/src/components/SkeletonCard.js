// src/components/SkeletonCard.js
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const SkeletonCard = () => {
  //create animated value
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    //animate opacity
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacity]);

  return (
    <View style={styles.container}>
      {/* 1. Icon Circle Placeholder */}
      <Animated.View style={[styles.iconCircle, { opacity }]} />

      {/* 2. Text Lines Placeholder */}
      <View style={styles.content}>
        <Animated.View style={[styles.line, { width: '60%', height: 16, marginBottom: 8 }, { opacity }]} />
        <Animated.View style={[styles.line, { width: '40%', height: 12, marginBottom: 8 }, { opacity }]} />
        <Animated.View style={[styles.line, { width: '80%', height: 12 }, { opacity }]} />
      </View>

      {/* 3. Image Placeholder */}
      <Animated.View style={[styles.imageSquare, { opacity }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0E0E0',
    marginRight: 16,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  line: {
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
  },
  imageSquare: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
  },
});

export default SkeletonCard;