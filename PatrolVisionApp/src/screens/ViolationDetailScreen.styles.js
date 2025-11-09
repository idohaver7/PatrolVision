// src/screens/ViolationDetailScreen.styles.js

import { StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors'; 

export default StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  image: {
    width: '100%',
    height: 250,
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: COLORS.background, 
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 12, 
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  label: {
    fontSize: 16,
    color: COLORS.textSecondary, 
  },
  value: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
});