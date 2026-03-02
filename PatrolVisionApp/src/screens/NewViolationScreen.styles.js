import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212', 
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 30,
    textAlign: 'center',
  },
  imageContainer: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#000',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  detailsContainer: {
    alignItems: 'center',
    width: '100%',
  },
  violationType: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  plateNumber: {
    fontSize: 18,
    color: '#B0B0B0', 
    marginBottom: 15,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 16,
    color: '#E0E0E0',
    marginLeft: 5,
  },
  timestamp: {
    fontSize: 14,
    color: '#888888', 
    marginTop: 5,
  }
});