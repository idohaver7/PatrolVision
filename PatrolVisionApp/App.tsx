// app.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

function App() {
  return (
    //wrap the app with the AuthProvider
    <AuthProvider>
      {/* 2. Wrap everything in the navigation container */}
      <NavigationContainer>
        {/* 3. Show the "switchboard" that decides what to show */}
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

export default App;