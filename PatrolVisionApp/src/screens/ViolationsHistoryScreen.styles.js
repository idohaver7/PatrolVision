// src/screens/ViolationsHistoryScreen.styles.js
import { StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';

export default StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FC', 
  },
  
  
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EFF2F5',
    height: 50,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginLeft: 10,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 40,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: 8,
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#fff',
  },

  // --- List Styles ---
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  
  // --- Violation Item Styles ---
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16, 
    marginBottom: 12,
  
    shadowColor: '#0D2A4D', 
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  itemPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  

  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  
  detailsContainer: {
    flex: 1,
    marginRight: 8,
  },
  
  // first Line: Violation Type
  violationType: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 4,
  },
  // second Line: License Plate and Status
    rowInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  licensePlate: {
    fontSize: 13,
    color: '#4A5568',
    fontWeight: '600',
    letterSpacing: 0.5,
    backgroundColor: '#F7FAFC', 
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 8,
  },
  // status Badge
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },

  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },

  // Loader
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});