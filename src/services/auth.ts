import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { getDb } from './db';
import { User } from '../types';

const SESSION_KEY = 'kpimanagex.session';

async function hash(value: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}

function rowToUser(row: any): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    passwordHash: row.passwordHash,
    pin: row.pin,
    isAdmin: !!row.isAdmin,
    createdAt: row.createdAt,
  };
}

export async function hasAnyUser(): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM users');
  return (row?.c ?? 0) > 0;
}

export async function registerUser(
  username: string,
  displayName: string,
  password: string,
  pin?: string,
  isAdmin = false
): Promise<User> {
  const db = await getDb();
  const passwordHash = await hash(password);
  const pinHash = pin ? await hash(pin) : null;
  const createdAt = new Date().toISOString();
  const result = await db.runAsync(
    'INSERT INTO users (username, displayName, passwordHash, pin, isAdmin, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    [username.trim().toLowerCase(), displayName.trim(), passwordHash, pinHash, isAdmin ? 1 : 0, createdAt]
  );
  return {
    id: result.lastInsertRowId,
    username: username.trim().toLowerCase(),
    displayName: displayName.trim(),
    passwordHash,
    pin: pinHash,
    isAdmin,
    createdAt,
  };
}

/** Crea la cuenta admin por defecto si todavía no existe (idempotente, seguro de llamar siempre). */
export async function seedAdminUser() {
  const db = await getDb();
  const existing = await db.getFirstAsync('SELECT id FROM users WHERE username = ?', ['admin']);
  if (existing) return;
  await registerUser('admin', 'Administrador', 'Adminkpi', undefined, true);
}

export async function login(username: string, password: string): Promise<User> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT * FROM users WHERE username = ?', [
    username.trim().toLowerCase(),
  ]);
  if (!row) throw new Error('Usuario no encontrado');
  const passwordHash = await hash(password);
  if (passwordHash !== row.passwordHash) throw new Error('Contraseña incorrecta');
  const user = rowToUser(row);
  await persistSession(user);
  return user;
}

export async function loginWithPin(pin: string): Promise<User> {
  const db = await getDb();
  const pinHash = await hash(pin);
  const row = await db.getFirstAsync<any>('SELECT * FROM users WHERE pin = ?', [pinHash]);
  if (!row) throw new Error('PIN incorrecto');
  const user = rowToUser(row);
  await persistSession(user);
  return user;
}

async function persistSession(user: User) {
  await SecureStore.setItemAsync(
    SESSION_KEY,
    JSON.stringify({ userId: user.id, username: user.username, displayName: user.displayName, isAdmin: user.isAdmin })
  );
}

export interface Session {
  userId: number;
  username: string;
  displayName: string;
  isAdmin: boolean;
}

export async function getSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function logout() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function getAllUsers(): Promise<User[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT * FROM users ORDER BY createdAt ASC');
  return rows.map(rowToUser);
}

export async function deleteUser(userId: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM users WHERE id = ?', [userId]);
}

export async function resetPassword(userId: number, newPassword: string) {
  const db = await getDb();
  const passwordHash = await hash(newPassword);
  await db.runAsync('UPDATE users SET passwordHash = ? WHERE id = ?', [passwordHash, userId]);
}

export async function setUserPin(userId: number, pin: string | null) {
  const db = await getDb();
  const pinHash = pin ? await hash(pin) : null;
  await db.runAsync('UPDATE users SET pin = ? WHERE id = ?', [pinHash, userId]);
}
