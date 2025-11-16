import { StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';

export default StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 20,
  },
  logoContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 16,
  },
  // Input Styles
  input: {
    width: '90%',
    height: 50,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
    fontSize: 16,
  },
  // Login Button
  button: {
    width: '90%',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonText: {
    color: COLORS.surface,
    fontSize: 18,
    fontWeight: '600',
  },
  // Register Button
  secondaryButton: {
    marginTop: 20,
  },
  secondaryButtonText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
});