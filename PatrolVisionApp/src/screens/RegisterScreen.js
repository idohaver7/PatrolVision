import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import styles from './RegisterScreen.styles'; 
import { useAuth } from '../context/AuthContext';

const RegisterScreen = ({ navigation }) => {
  const { login } = useAuth(); // Use login to automatically log in after registration

  const handleRegister = () => {
    // TODO: Add registration logic
    // After successful registration, log the user in
    login(); 
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      <TextInput style={styles.input} placeholder="Full Name" />
      <TextInput style={styles.input} placeholder="Email" />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry={true} />

      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default RegisterScreen;