// src/screens/ViolationDetailScreen.js
import React from 'react';
import { 
  View, 
  Text, 
  Image, 
  ScrollView, 
  TouchableOpacity, 
  Linking 
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import styles from './ViolationDetailScreen.styles';
import { COLORS } from '../theme/colors';

const ViolationDetailScreen = ({ route }) => {
  
  //  Get the data passed directly from the History list
  const { violation } = route.params;

  // --- Helper Functions ---
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'Verified': return '#28a745'; // Green
      case 'Rejected': 
      case 'Closed': return '#dc3545';   // Red
      default: return '#ffc107';         // Yellow
    }
  };

  const openMap = () => {
    if (!violation.location) return;
    // MongoDB stores as [longitude, latitude]
    const [lng, lat] = violation.location.coordinates;
    // Opens Google Maps (or Waze) at this location
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/*  Header Image */}
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: violation.mediaUrl }} 
            style={styles.image} 
            resizeMode="contain" 
            resizeMethod='resize'
          />
        </View>

        {/*  Details Card (Floating) */}
        <View style={styles.detailsCard}>
          
          {/* Title & Status Badge */}
          <View style={styles.headerRow}>
            <Text style={styles.title}>{violation.violationType}</Text>
            
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(violation.status) }]}>
              <Text style={styles.statusText}>{violation.status}</Text>
            </View>
          </View>

          {/* Info Row: License Plate */}
          <InfoRow 
            icon="directions-car" 
            label="License Plate" 
            value={violation.licensePlate} 
          />
          
          {/* Info Row: Date & Time */}
          <InfoRow 
            icon="event" 
            label="Date & Time" 
            value={`${new Date(violation.timestamp).toLocaleDateString()} • ${new Date(violation.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`} 
          />

          {/* Info Row: Location (Clickable) */}
          <TouchableOpacity onPress={openMap}>
            <InfoRow 
              icon="place" 
              label="Location" 
              value={`${violation.address || 'Unknown Road'}\n(GPS: ${violation.location.coordinates[1].toFixed(5)}, ${violation.location.coordinates[0].toFixed(5)})`}
              isLink 
            />
          </TouchableOpacity>

          {/* Info Row: Reported By (Only if user info exists) */}
          {violation.user && (
            <InfoRow 
              icon="person" 
              label="Reported By" 
              value={`${violation.user.firstName} ${violation.user.lastName}\n${violation.user.phoneNumber || ''}`} 
            />
          )}

        </View>
      </ScrollView>
    </View>
  );
};

// Helper Component for consistent rows
const InfoRow = ({ icon, label, value, isLink }) => (
  <View style={styles.infoRow}>
    <Icon name={icon} size={24} color={COLORS.primary} />
    <View style={styles.infoContent}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {isLink && <Text style={styles.linkText}>Tap to open in Maps ↗</Text>}
    </View>
  </View>
);

export default ViolationDetailScreen;