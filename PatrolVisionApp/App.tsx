// app.tsx

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import MainNavigator from './src/navigation/MainNavigator'; // <-- Import our new "department"

// This is the root component of the entire app
function App() {
  return (
    // NavigationContainer wraps everything
    <NavigationContainer>
      {/* We just render our main navigator */}
      <MainNavigator />
    </NavigationContainer>
  );
}

export default App;