import { StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    ...StyleSheet.absoluteFill, 
  },
  overlayContainer: {
    ...StyleSheet.absoluteFill, 
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)', 
    borderRadius: 25, 
    padding: 10,
  },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#000',
  },
  messageText: {
    color: COLORS.surface,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
});