import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from '../screens/LoginScreen';
import RouteScreen from '../screens/RouteScreen';
import ClientProfileScreen from '../screens/ClientProfileScreen';
import CollectPaymentScreen from '../screens/CollectPaymentScreen';
import ReceiptScreen from '../screens/ReceiptScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('token').then(token => {
      setIsLoggedIn(!!token);
    });
  }, []);

  if (isLoggedIn === null) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isLoggedIn ? (
          <>
            <Stack.Screen name="Route" component={RouteScreen} />
            <Stack.Screen name="ClientProfile" component={ClientProfileScreen} />
            <Stack.Screen name="CollectPayment" component={CollectPaymentScreen} />
            <Stack.Screen name="Receipt" component={ReceiptScreen} />
          </>
        ) : (
          <Stack.Screen name="Login">
            {props => <LoginScreen {...props} onLogin={() => setIsLoggedIn(true)} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
