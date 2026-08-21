import 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { useAuthStore } from './src/store/authStore';
import { initDb } from './src/services/db';
import { seedAdminUser } from './src/services/auth';

import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { LockScreen } from './src/screens/LockScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { NewArqueoScreen } from './src/screens/NewArqueoScreen';
import { ScannerScreen } from './src/screens/ScannerScreen';
import { ArqueoDetailScreen } from './src/screens/ArqueoDetailScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { EmployeesScreen } from './src/screens/EmployeesScreen';
import { RootStackParamList } from './src/navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const AUTO_LOCK_MS = 3 * 60 * 1000; // 3 minutos en segundo plano

function AuthGate() {
  const { colors } = useTheme();
  const { user, ready, hasUsers, locked, restore, lock } = useAuthStore();
  const [dbReady, setDbReady] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    initDb()
      .then(() => seedAdminUser())
      .then(() => setDbReady(true))
      .then(() => restore());
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        backgroundedAt.current = Date.now();
      } else if (next === 'active' && backgroundedAt.current) {
        const elapsed = Date.now() - backgroundedAt.current;
        if (elapsed > AUTO_LOCK_MS && user) lock();
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, [user, lock]);

  useEffect(() => {
    if (!hasUsers) setShowRegister(true);
  }, [hasUsers, ready]);

  const prevUser = useRef(user);
  useEffect(() => {
    // Si veníamos de una sesión activa y se cerró (logout), volvemos siempre
    // al login en vez de quedarnos en la pantalla de "Nuevo empleado".
    if (prevUser.current && !user) setShowRegister(false);
    prevUser.current = user;
  }, [user]);

  if (!dbReady || !ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color="#10B981" size="large" />
      </View>
    );
  }

  if (!user) {
    if (showRegister) {
      return <RegisterScreen isFirstUser={!hasUsers} onGoLogin={() => setShowRegister(false)} />;
    }
    return <LoginScreen onGoRegister={() => setShowRegister(true)} />;
  }

  if (locked) {
    return <LockScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="NewArqueo" component={NewArqueoScreen} />
        <Stack.Screen name="Scanner" component={ScannerScreen} />
        <Stack.Screen name="ArqueoDetail" component={ArqueoDetailScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Employees" component={EmployeesScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthGate />
          <StatusBar style="auto" />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
