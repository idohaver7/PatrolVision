// src/screens/RegisterScreen.js
import React from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator,
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Formik } from 'formik';
import * as Yup from 'yup';
import styles from './RegisterScreen.styles';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

// 1. Define Validation Schema using Yup
const RegisterSchema = Yup.object().shape({
  firstName: Yup.string()
    .min(2, 'Too short')
    .required('First name is required'),
  lastName: Yup.string()
    .min(2, 'Too short')
    .required('Last name is required'),
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  phone: Yup.string()
    .length(10, 'Invalid phone number')
    .required('Phone number is required'),
  password: Yup.string()
    .min(6, 'Must be at least 6 characters')
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password'), null], 'Passwords must match')
    .required('Confirm password is required'),
});

const RegisterScreen = ({ navigation }) => {
  const { register, isLoading } = useAuth();

  // Function to run only if validation passes
  const handleFormSubmit = async (values) => {
    // Prepare data for the server (Matching the Node.js User Model)
    const userDataToSend = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      password: values.password,
      phoneNumber: values.phone
    };

    const result = await register(userDataToSend);

    if (!result.success) {
      Alert.alert('Error', result.error || 'Registration failed');
    }
    // If successful - RootNavigator will automatically switch to Home
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* KeyboardAvoidingView ensures the keyboard doesn't cover input fields */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>

          <View style={styles.logoContainer}>
            <Icon name="directions-car" size={120} color={COLORS.primary} />
            <Text style={styles.logoTitle}>PatrolVision</Text> 
          </View>
          
          <Text style={styles.title}>Create Account</Text>

          <Formik
            initialValues={{ firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '' }}
            validationSchema={RegisterSchema}
            onSubmit={handleFormSubmit}
          >
            {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
              <>
                <InputModule 
                  placeholder="First Name"
                  value={values.firstName}
                  onChangeText={handleChange('firstName')}
                  onBlur={handleBlur('firstName')}
                  error={touched.firstName && errors.firstName}
                />
                
                <InputModule 
                  placeholder="Last Name"
                  value={values.lastName}
                  onChangeText={handleChange('lastName')}
                  onBlur={handleBlur('lastName')}
                  error={touched.lastName && errors.lastName}
                />

                <InputModule 
                  placeholder="Email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={values.email}
                  onChangeText={handleChange('email')}
                  onBlur={handleBlur('email')}
                  error={touched.email && errors.email}
                />

                <InputModule 
                  placeholder="Phone Number"
                  keyboardType="phone-pad"
                  value={values.phone}
                  onChangeText={handleChange('phone')}
                  onBlur={handleBlur('phone')}
                  error={touched.phone && errors.phone}
                />

                <InputModule 
                  placeholder="Password"
                  secureTextEntry
                  autoCapitalize="none"
                  value={values.password}
                  onChangeText={handleChange('password')}
                  onBlur={handleBlur('password')}
                  error={touched.password && errors.password}
                />

                <InputModule 
                  placeholder="Confirm Password"
                  secureTextEntry
                  autoCapitalize="none"
                  value={values.confirmPassword}
                  onChangeText={handleChange('confirmPassword')}
                  onBlur={handleBlur('confirmPassword')}
                  error={touched.confirmPassword && errors.confirmPassword}
                />

                <TouchableOpacity 
                  style={styles.button} 
                  onPress={handleSubmit}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={COLORS.surface} />
                  ) : (
                    <Text style={styles.buttonText}>Sign Up</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </Formik>

          <TouchableOpacity 
            style={styles.secondaryButton} 
            onPress={() => navigation.goBack()} // Go back to Login
          >
            <Text style={styles.secondaryButtonText}>Already have an account? Log In</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// Internal Helper Component for cleaner JSX (Avoids repeating TextInput logic)
const InputModule = ({ placeholder, value, onChangeText, onBlur, error, secureTextEntry, keyboardType, autoCapitalize }) => (
  <>
    <TextInput
      style={[styles.input, error ? styles.inputError : null]}
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      onBlur={onBlur}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
    />
    {error ? (
      <Text style={styles.errorText}>{error}</Text>
    ) : (
      <View style={styles.spacer} />
    )}
  </>
);

export default RegisterScreen;