// src/navigation/RootNavigator.tsx
import { useAuth } from '../context/AuthContext';
import MainNavigator from './MainNavigator';
import AuthNavigator from './AuthNavigator';
import SplashScreen from '../components/SplashScreen';

const RootNavigator = () => {
  //Get the authentication state
  const { isLoggedIn, isLoading } = useAuth();

  // If logged in -> show the main app
  // If not -> show the auth screens
  if (isLoading) {
    return <SplashScreen />;
  }

  return isLoggedIn ? <MainNavigator /> : <AuthNavigator />;
};

export default RootNavigator;