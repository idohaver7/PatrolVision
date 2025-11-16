// src/screens/ViolationDetailScreen.js
import React from 'react';
import { View, Text, StyleSheet, Image} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import styles from './ViolationDetailScreen.styles';

// This screen receives 'route' as a prop,
// which contains the data we passed from the previous screen.
const ViolationDetailScreen = ({ route }) => {
  // Extract the 'violation' object from the route params
  const { violation } = route.params;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* We can use a bigger image here */}
        <Image source={{ uri: violation.image_url.replace('100/100', '400/300') }} style={styles.image} />
        
        <Text style={styles.title}>{violation.type}</Text>
        
        <View style={styles.detailRow}>
          <Text style={styles.label}>License Plate:</Text>
          <Text style={styles.value}>{violation.license_plate}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Date & Time:</Text>
          <Text style={styles.value}>{violation.date}</Text>
        </View>
        
        {/* We can add more details here later, like GPS */}
      </View>
    </SafeAreaView>
  );
};


export default ViolationDetailScreen;