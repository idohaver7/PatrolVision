/// app.tsx  <-- Note the .tsx extension

import React from 'react';
// Import the new screen we created
import ViolationsHistoryScreen from './src/screens/ViolationsHistoryScreen';

const App = () => {
  // Here we are telling the app to display our screen
  return <ViolationsHistoryScreen />;
};

export default App;