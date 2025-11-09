// src/screens/HomeScreen.styles.js
import { StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';

export default StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center', // Center content vertically
    alignItems: 'center',     // Center content horizontally
    backgroundColor: COLORS.background,
    padding: 20,
  },
  logoContainer: {
    marginBottom: 50,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  buttonContainer: {
    width: '90%', // Make buttons wide
  },
  // Main button style
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 10,
    marginBottom: 16,
    // Add shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonText: {
    color: COLORS.surface,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  // Secondary button style (for history, settings)
  secondaryButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
    elevation: 2, // Less shadow
    shadowOpacity: 0.1,
  },
  secondaryButtonText: {
    color: COLORS.primary,
  },
  buttonIcon: {
    color: COLORS.surface, // Default color (white)
  },
  secondaryButtonIcon: {
    color: COLORS.primary, // Icon color for secondary buttons
  },
});