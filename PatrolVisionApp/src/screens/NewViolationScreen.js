import React, { useState, useContext } from 'react';
import { View, Text, Image, TextInput, Button, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import styles from './NewViolationScreen.styles';
import { COLORS } from '../theme/colors';
import { reportViolation } from '../services/api';
import { useAuth } from '../context/AuthContext'; 

const NewViolationScreen = ({ route, navigation }) => {
 //Get data passed from the detection screen
  const { violationType, plate, imageUri, location } = route.params;
  
  const [licensePlate, setLicensePlate] = useState(plate || '');
  const [isLoading, setIsLoading] = useState(false);
 
  const { token } = useAuth(); // Use the hook to get userToken from context

  const handleSendReport = async () => {
    if (!licensePlate) {
      Alert.alert("Missing Info", "Please check the license plate number.");
      return;
    }

    setIsLoading(true);
    
    const reportData = {
      violationType,
      licensePlate,
      imageUri, // original image as evidence
      latitude: location?.latitude || 0,
      longitude: location?.longitude || 0,
    };

    const result = await reportViolation(token, reportData);

    setIsLoading(false);

    if (result.success) {
      Alert.alert("Success", "Violation reported successfully!", [
        { text: "OK", onPress: () => navigation.navigate('Home') }
      ]);
    } else {
      Alert.alert("Error", result.error);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>⚠️ Violation Detected!</Text>
      
      <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />

      <View style={styles.form}>
        <Text style={styles.label}>Type:</Text>
        <Text style={styles.value}>{violationType}</Text>

        <Text style={styles.label}>License Plate (Editable):</Text>
        <TextInput
          style={styles.input}
          value={licensePlate}
          onChangeText={setLicensePlate}
          placeholder="Enter Plate Number"
        />

        {isLoading ? (
          <ActivityIndicator size="large" color={COLORS.primary} />
        ) : (
          <View style={styles.buttons}>
             <Button title="Confirm & Report" color="red" onPress={handleSendReport} />
             <View style={{marginTop: 10}}>
                <Button title="Discard" color="gray" onPress={() => navigation.goBack()} />
             </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
};
export default NewViolationScreen;