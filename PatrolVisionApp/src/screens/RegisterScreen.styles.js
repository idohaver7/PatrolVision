// src/screens/RegisterScreen.styles.js
import { StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30, 
  },
  logoTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 16,
  },
  // ScrollView container to center content
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
  },
  //title style
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 20, 
    textAlign: 'center',
  },
  //Input Styles 
  input: {
    width: '100%',
    height: 50,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  
  // --- Input Error Styles ---
  inputError: {
    borderColor: COLORS.danger, 
    borderWidth: 1.5,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    width: '100%',
    textAlign: 'left',
    marginTop: 4,
    marginBottom: 10,
    paddingHorizontal: 5,
  },
  spacer: {
    marginBottom: 12, 
  },
  // ----------------------------------

  // Login/Register Button
  button: {
    width: '100%', 
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
  },
  buttonText: {
    color: COLORS.surface,
    fontSize: 18,
    fontWeight: '600',
  },

  // "Have an account?" Button
  secondaryButton: {
    marginTop: 20,
    paddingBottom: 20, 
  },
  secondaryButtonText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
});