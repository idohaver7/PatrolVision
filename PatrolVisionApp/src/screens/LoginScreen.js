import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import styles from './LoginScreen.styles';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext'; 

const LoginScreen = ({ navigation }) => {
  //Use the Hook to get the login function
  const { login } = useAuth();

  const handleLogin = () => {
    //ToDO: Add username/password check
    login(); // 3. Call the function from the Context
  };

  const goToRegister = () => {
    navigation.navigate('Register'); // Navigate to the Register screen
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logoContainer}>
        {/* Logo as it appears on the home screen */}
        <Icon name="directions-car" size={120} color={COLORS.primary} />
        <Text style={styles.title}>PatrolVision</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Email or Username"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry={true} // Hides the password
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Log In</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={goToRegister}>
        <Text style={styles.secondaryButtonText}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default LoginScreen;