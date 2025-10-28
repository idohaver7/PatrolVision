
import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
} from 'react-native';

// "Mock Data" - This simulates the data that will come from the server
// Based on your design
const MOCK_VIOLATIONS = [
  {
    id: '1',
    type: 'Illegal Overtaking',
    license_plate: 'DEF 7890',
    date: 'Nov 30, 2023, 9:41 AM',
    image_url: 'https://picsum.photos/seed/1/100/100', // Random image
  },
  {
    id: '2',
    type: 'Red Light Violation',
    license_plate: 'ABC 1254',
    date: 'May 15, 2022, 11:14 AM',
    image_url: 'https://picsum.photos/seed/2/100/100',
  },
  {
    id: '3',
    type: 'Wrong Way Driving',
    license_plate: 'GFH 0867',
    date: 'Aug 25, 2021, 8:05 AM',
    image_url: 'https://picsum.photos/seed/3/100/100',
  },
];

// This is a "component" that represents a single row in the list
const ViolationItem = ({ item }) => (
  <View style={styles.itemContainer}>
    {/* Warning icon (currently text, we'll replace with a real icon) */}
    <Text style={styles.icon}>⚠️</Text> 
    
    {/* Violation details */}
    <View style={styles.detailsContainer}>
      <Text style={styles.violationType}>{item.type}</Text>
      <Text style={styles.licensePlate}>{item.license_plate}</Text>
      <Text style={styles.date}>{item.date}</Text>
    </View>
    
    {/* Thumbnail image */}
    <Image source={{ uri: item.image_url }} style={styles.thumbnail} />
    
    {/* Arrow (currently text) */}
    <Text style={styles.arrow}>❯</Text>
  </View>
);

// This is the component for the "Screen" itself
const ViolationsHistoryScreen = () => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Violations History</Text>
        {/* The filter and sort components will go here */}
      </View>
      
      {/* This is the list itself */}
      <FlatList
        data={MOCK_VIOLATIONS} // The data to display
        renderItem={ViolationItem} // The function that renders each row
        keyExtractor={item => item.id} // A unique identifier for each row
        style={styles.list}
      />
    </SafeAreaView>
  );
};

// This is where we define the styles (similar to CSS)
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f4f4', // Light gray background like in the mockup
  },
  header: {
    padding: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  list: {
    flex: 1,
  },
  itemContainer: {
    flexDirection: 'row', // Arrange items in a row (horizontally)
    alignItems: 'center', // Vertical centering
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  icon: {
    fontSize: 24,
    marginRight: 16,
  },
  detailsContainer: {
    flex: 1, // This makes it take up all available space
  },
  violationType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  licensePlate: {
    fontSize: 14,
    color: '#333',
  },
  date: {
    fontSize: 12,
    color: '#777',
  },
  thumbnail: {
    width: 60,
    height: 40,
    borderRadius: 4,
    marginLeft: 16,
  },
  arrow: {
    fontSize: 20,
    color: '#aaa',
    marginLeft: 16,
  },
});

export default ViolationsHistoryScreen;