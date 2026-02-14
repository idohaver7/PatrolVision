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
  // --- Top Bar ---
  topBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between', // זה מפזר את ה-REC לשמאל ואת ה-GPS לימין
    alignItems: 'center',
    zIndex: 10,
  },
  
  // REC Indicator
  recContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  recDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
    marginRight: 8,
  },
  recText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 1,
  },

  // GPS & Speed Indicator (חדש)
  gpsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  speedText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
    marginRight: 5,
    fontVariant: ['tabular-nums'], // מונע קפיצות של הטקסט כשהמספרים משתנים
  },

  // --- Bottom Slider Area ---
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)', 
    paddingTop: 20,
  },
  sliderContainer: {
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 30,
    justifyContent: 'center',
    padding: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  sliderThumb: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: 5,
    zIndex: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sliderText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
    zIndex: 1,
  },
});