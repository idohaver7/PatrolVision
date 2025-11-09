// src/navigation/MainNavigator.tsx

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { COLORS } from '../theme/colors';

// 1. Import the new HomeScreen
import HomeScreen from '../screens/HomeScreen'; 
import ViolationsHistoryScreen from '../screens/ViolationsHistoryScreen';
import ViolationDetailScreen from '../screens/ViolationDetailScreen';

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
      
      {/* 3. Add HomeScreen to the stack */}
      <Stack.Screen 
        name="Home"
        component={HomeScreen}
        // 4. We hide the header for the main home screen
        options={{ headerShown: false }} 
      />

      {/* These screens remain the same */}
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