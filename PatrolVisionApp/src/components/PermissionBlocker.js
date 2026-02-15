import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, StatusBar, PermissionsAndroid, Platform } from 'react-native';
import { Camera } from 'react-native-vision-camera';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Screen that appears if permissions are not granted, prompting the user to allow them
const PermissionBlocker = ({ onCheckAgain }) => {

  const handleRequestPermissions = async () => {
    // request permissions again when user clicks the button
    await Camera.requestCameraPermission();
    
    //request location permission again (only needed for Android, iOS is handled via Info.plist)
    if (Platform.OS === 'android') {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      ]);
    }
    
    //check permissions again after requesting
    onCheckAgain();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <Icon name="verified-user" size={80} color="#2196F3" />
      
      <Text style={styles.title}>Welcome to PatrolVision</Text>
      <Text style={styles.subtitle}>
       To ensure the best experience, please allow camera and location permissions.
      </Text>

      {/* button to request permissions again */}
      <TouchableOpacity style={styles.button} onPress={handleRequestPermissions}>
        <Text style={styles.buttonText}>Allow Permissions</Text>
      </TouchableOpacity>

      {/* Second button to open device settings */}
      <TouchableOpacity onPress={() => Linking.openSettings()} style={{marginTop: 20}}>
        <Text style={styles.linkText}>Not working? Open Device Settings</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center', padding: 30 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginTop: 20, marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#ccc', textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  button: { backgroundColor: '#2196F3', paddingVertical: 14, paddingHorizontal: 30, borderRadius: 8, width: '100%', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  linkText: { color: '#888', textDecorationLine: 'underline' }
});

export default PermissionBlocker;