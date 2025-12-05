import React from 'react';
import {useState} from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import styles from './LoginScreen.styles';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext'; 

const LoginScreen = ({ navigation }) => {
  //Use the Hook to get the login function
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Error states
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const[generalError, setGeneralError] = useState('');

  const handleLogin = async () => {
    setEmailError('');
    setPasswordError('');
    setGeneralError('')
    ;
    let isValid = true;

    if (!email) {
    setEmailError('Email is required');
    isValid = false;
    }

    if (!password) {
    setPasswordError('Password is required');
    isValid = false;
    }
    if (!isValid) {
      return;
    }
    const result = await login(email, password);
    if (!result.success) {
      setGeneralError(result.error || 'An error occurred during login.');
      }
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

      {/*Email Input */}
      <TextInput
        style={[
          styles.input, 
          emailError ? styles.inputError : null 
        ]}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (emailError) setEmailError(''); 
        }}
      />
      {emailError ?( <Text style={styles.errorText}>{emailError}</Text> ): (<View style={styles.spacer} /> )}

      {/* Password Input */}
      <TextInput
        style={[
          styles.input, 
          passwordError ? styles.inputError : null 
        ]}
        placeholder="Password"
        autoCapitalize="none"
        secureTextEntry={true} // Hides the password
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          if (passwordError) setPasswordError('');
        }}    
      />
      {/* Password Error Message */}
      {passwordError ? (
        <Text style={styles.errorText}>{passwordError}</Text>
      ) : (
        <View style={styles.spacer} />
      )}
      {/* General Error Message */}
      {generalError ? (
        <View style={styles.generalErrorContainer}>
          <Text style={styles.generalErrorText}>{generalError}</Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator color={COLORS.surface} />
        ) : (
        <Text style={styles.buttonText}>Log In</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={goToRegister}>
        <Text style={styles.secondaryButtonText}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default LoginScreen;