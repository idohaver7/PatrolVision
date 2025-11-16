// src/navigation/RootNavigator.tsx
import { useAuth } from '../context/AuthContext';
import MainNavigator from './MainNavigator';
import AuthNavigator from './AuthNavigator';

const RootNavigator = () => {
  //Get the authentication state
  const { isLoggedIn } = useAuth();

  // If logged in -> show the main app
  // If not -> show the auth screens
  return isLoggedIn ? <MainNavigator /> : <AuthNavigator />;
};

export default RootNavigator;