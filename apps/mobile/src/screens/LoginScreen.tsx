import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth';
import { HowDojobidWorksLink } from '../components/HowDojobidWorks';
import { colors, styles } from '../theme';

export default function LoginScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('contractor@example.com');
  const [password, setPassword] = useState('Password123!');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<'HOMEOWNER' | 'CONTRACTOR'>('CONTRACTOR');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register({ email, password, firstName, lastName, role });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={[styles.content, { justifyContent: 'center', flexGrow: 1 }]}>
        <Image
          source={require('../../assets/logo.png')}
          style={{ width: 240, height: 96, alignSelf: 'center', marginBottom: 8 }}
          resizeMode="contain"
        />
        <Text style={[styles.subtitle, { textAlign: 'center' }]}>
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </Text>

        <View style={styles.card}>
          {mode === 'register' && (
            <>
              <Text style={styles.label}>First name</Text>
              <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} />
              <Text style={styles.label}>Last name</Text>
              <TextInput style={styles.input} value={lastName} onChangeText={setLastName} />
              <Text style={styles.label}>I am a</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                {(['HOMEOWNER', 'CONTRACTOR'] as const).map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setRole(r)}
                    style={[
                      styles.button,
                      { flex: 1, marginTop: 0 },
                      role !== r && styles.buttonSecondary,
                    ]}
                  >
                    <Text style={role === r ? styles.buttonText : styles.buttonTextSecondary}>
                      {r === 'HOMEOWNER' ? 'Homeowner' : 'Contractor'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={styles.label}>Email</Text>
          <View style={local.emailInputRow}>
            <TextInput
              style={[styles.input, local.emailInput]}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
            {email.length > 0 ? (
              <TouchableOpacity
                style={local.emailClearBtn}
                onPress={() => setEmail('')}
                disabled={busy}
                accessibilityLabel="Clear email"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={20} color={colors.muted} />
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={styles.button} onPress={submit} disabled={busy}>
            <Text style={styles.buttonText}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
        >
          <Text style={{ color: colors.primary, textAlign: 'center' }}>
            {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign in'}
          </Text>
        </TouchableOpacity>

        <View style={{ marginTop: 16 }}>
          <HowDojobidWorksLink />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const local = StyleSheet.create({
  emailInputRow: {
    position: 'relative',
  },
  emailInput: {
    paddingRight: 36,
  },
  emailClearBtn: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
