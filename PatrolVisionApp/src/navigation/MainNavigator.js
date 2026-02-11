
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { COLORS } from '../theme/colors';

import HomeScreen from '../screens/HomeScreen'; 
import ViolationsHistoryScreen from '../screens/ViolationsHistoryScreen';
import ViolationDetailScreen from '../screens/ViolationDetailScreen';
import LiveCameraScreen from '../screens/LiveCameraScreen';
import NewViolationScreen from '../screens/NewViolationScreen';

const Stack = createNativeStackNavigator();

const MainNavigator = () => {
  return (
    <Stack.Navigator
      // Global styles for all headers
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.primary,
        },
        headerTintColor: COLORS.surface,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
      // 2. Set the *initial* route to be our new HomeScreen
      initialRouteName="Home"
    >
      
      {/* Add all screens to the navigator */}
      <Stack.Screen 
        name="Home"
        component={HomeScreen}
        // 4. We hide the header for the main home screen
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="LiveCamera"
        component={LiveCameraScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen 
        name="NewViolation"
        component={NewViolationScreen}
        options={{ title: 'Confirm Report', headerShown: false }}
      />
      <Stack.Screen 
        name="ViolationsHistory"
        component={ViolationsHistoryScreen}
        options={{ title: 'Violations History' }}
      />
      <Stack.Screen 
        name="ViolationDetail"
        component={ViolationDetailScreen}
        options={{ title: 'Violation Details' }}
      />

    </Stack.Navigator>
  );
};

export default MainNavigator;