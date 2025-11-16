// src/screens/HomeScreen.js
import React from 'react';
import { View, Text,TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import styles from './HomeScreen.styles';
import { COLORS } from '../theme/colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';


// We get 'navigation' as a prop from the navigator
const HomeScreen = ({ navigation }) => {
  const { logout } = useAuth();
  
  const handleLogout = () => {
    logout();
  }
  // Navigation functions
  const onStartDrive = () => {
    navigation.navigate('LiveCamera');
  };

  const onHistory = () => {
    navigation.navigate('ViolationsHistory');
  };

  const onSettings = () => {
    // We'll create this screen later
    alert('Navigate to Settings Screen (TODO)');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Logo and Title */}
      <View style={styles.logoContainer}>
        {/* This will be our "cute logo" */}
        <Icon name="directions-car" size={120} color={COLORS.primary} />
        <Text style={styles.title}>PatrolVision</Text>
        <Text style={styles.subtitle}>Your AI Dashcam Assistant</Text>
      </View>

      {/* Buttons */}
      <View style={styles.buttonContainer}>
        {/* Start Drive Button (Primary) */}
        <TouchableOpacity style={styles.button} onPress={onStartDrive}>
          <Icon name="play-arrow" size={24} style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Start Drive</Text>
        </TouchableOpacity>

        {/* Violations History Button (Secondary) */}
        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]} 
          onPress={onHistory}
        >
          <Icon name="history" size={24} style={styles.secondaryButtonIcon} />
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>
            Violations History
          </Text>
        </TouchableOpacity>

        {/* Settings Button (Secondary) */}
        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]} 
          onPress={onSettings}
        >
          <Icon name="settings" size={24} style={styles.secondaryButtonIcon} />
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>
            Settings
          </Text>
        </TouchableOpacity>
        {/* Logout Button (Secondary) */}
        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]} 
          onPress={handleLogout}
        >
          <Icon name="logout" size={24} style={styles.secondaryButtonIcon} />
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>
            Log Out
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default HomeScreen;