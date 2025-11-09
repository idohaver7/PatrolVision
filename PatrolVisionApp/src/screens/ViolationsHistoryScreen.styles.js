// src/screens/ViolationsHistoryScreen.styles.js

import { StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';

export default StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  
  // Style for the loading spinner container
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.textSecondary,
  },

  // Card style
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    transition: 'transform 0.1s ease', // (Note: 'transition' is web-only, but good practice)
  },

  // This style is applied when 'itemContainer' is pressed
  itemPressed: {
    transform: [{ scale: 0.98 }], // Makes the card slightly smaller
    opacity: 0.9, // Makes the card slightly transparent
  },

  icon: {
    marginRight: 16,
  },
  detailsContainer: {
    flex: 1,
  },
  violationType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  licensePlate: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  date: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  thumbnail: {
    width: 60,
    height: 40,
    borderRadius: 4,
    marginLeft: 16,
  },
  arrow: {
    marginLeft: 8,
  },
});