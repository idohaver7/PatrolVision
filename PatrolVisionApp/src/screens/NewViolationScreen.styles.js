import { StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';
export default StyleSheet.create({
     container: { flexGrow: 1, padding: 20, backgroundColor: COLORS.surface || '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', color: 'red', textAlign: 'center', marginBottom: 20 },
  image: { width: '100%', height: 250, borderRadius: 10, marginBottom: 20 },
  form: { gap: 10 },
  label: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  value: { fontSize: 18, marginBottom: 10, color: '#555' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, fontSize: 18, marginBottom: 20 },
  buttons: { marginTop: 10 }
});