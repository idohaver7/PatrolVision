// src/screens/ViolationsHistoryScreen.js

import React, { useState, useEffect } from 'react'; // <-- 1. Import useState and useEffect
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable, // <-- 2. Import Pressable (instead of TouchableOpacity)
  ActivityIndicator, 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons'; // <-- 4. Import the Icon library
import styles from './ViolationsHistoryScreen.styles';
import { COLORS } from '../theme/colors';

// Mock Data (unchanged)
const MOCK_VIOLATIONS = [
  { id: '1', type: 'Illegal Overtaking', license_plate: 'DEF 7890', date: 'Nov 30, 2023, 9:41 AM', image_url: 'https://picsum.photos/seed/1/100/100' },
  { id: '2', type: 'Red Light Violation', license_plate: 'ABC 1254', date: 'May 15, 2022, 11:14 AM', image_url: 'https://picsum.photos/seed/2/100/100' },
  { id: '3', type: 'Wrong Way Driving', license_plate: 'GFH 0867', date: 'Aug 25, 2021, 8:05 AM', image_url: 'https://picsum.photos/seed/3/100/100' },
];

// 5. We use Pressable for a better press effect
const ViolationItem = ({ item, onPress }) => (
  <Pressable
    onPress={onPress}
    // This style applies effects when the item is pressed
    style={({ pressed }) => [
      styles.itemContainer,
      pressed && styles.itemPressed, // <-- 6. Apply "pressed" style
    ]}
  >
    {/* 7. Replaced the ⚠️ emoji with a real icon */}
    <Icon name="warning" size={30} color={COLORS.warning} style={styles.icon} />
    
    <View style={styles.detailsContainer}>
      <Text style={styles.violationType}>{item.type}</Text>
      <Text style={styles.licensePlate}>{item.license_plate}</Text>
      <Text style={styles.date}>{item.date}</Text>
    </View>
    
    <Image source={{ uri: item.image_url }} style={styles.thumbnail} />
    
    {/* 8. Replaced the ❯ emoji with a real icon */}
    <Icon name="chevron-right" size={30} color="#aaa" style={styles.arrow} />
  </Pressable>
);

const ViolationsHistoryScreen = ({ navigation }) => {
  // 9. Add loading state. Default to 'true'
  const [isLoading, setIsLoading] = useState(true);

  // 10. Simulate a network request when the screen loads
  useEffect(() => {
    // Wait for 1.5 seconds, then "load" the data
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);

    // Clear the timer if the component unmounts
    return () => clearTimeout(timer);
  }, []); // The empty array [] means this runs only once

  const handleItemPress = (violation) => {
    navigation.navigate('ViolationDetail', { violation: violation });
  };

  // 11. This is the new loading component
  const renderLoader = () => (
    <View style={styles.loaderContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Loading Violations...</Text>
    </View>
  );

  // 12. This is the main list component
  const renderList = () => (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={MOCK_VIOLATIONS}
        renderItem={({ item }) => (
          <ViolationItem 
            item={item} 
            onPress={() => handleItemPress(item)} 
          />
        )}
        keyExtractor={item => item.id}
        style={styles.list}
        // Add some padding at the top of the list
        ListHeaderComponent={<View style={{ height: 16 }} />} 
      />
    </SafeAreaView>
  );

  // 13. Conditional rendering: show loader or list
  return isLoading ? renderLoader() : renderList();
};

export default ViolationsHistoryScreen;