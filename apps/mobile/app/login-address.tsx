import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/api';
import { invalidateAuthSession } from '../lib/authSession';
import { afterAuthNavigate } from '../lib/openLogin';
import { theme, spacing, radius } from '../lib/theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { AuthFormField } from '../components/auth/AuthFormField';
import { addressToAppLocation, saveDeliveryLocation } from '../lib/deliveryLocation';
import { useAuthSession } from '../lib/useAuthSession';
import { useAddToCartFlow } from '../components/AddToCartFlowProvider';
import { clearPendingAddToCart, loadPendingAddToCart } from '../lib/pendingAddToCart';

type AddressType = 'home' | 'work' | 'other';

export default function LoginAddressScreen() {
  const { startAddToCart } = useAddToCartFlow();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const auth = useAuthSession();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const profileDisplayName = useMemo(() => {
    const dn = auth.me.data?.displayName?.trim();
    if (dn && dn.toLowerCase() !== 'customer') return dn;
    const first = auth.me.data?.firstName?.trim();
    const last = auth.me.data?.lastName?.trim();
    if (first && first.toLowerCase() !== 'customer') {
      return last ? `${first} ${last}`.trim() : first;
    }
    return '';
  }, [auth.me.data]);

  const useProfileName = profileDisplayName.length >= 2;

  useEffect(() => {
    if (profileDisplayName) setFullName(profileDisplayName);
    if (auth.me.data?.phone) setPhone(auth.me.data.phone.replace(/\D/g, '').slice(-10));
  }, [auth.me.data?.phone, profileDisplayName]);
  const [house, setHouse] = useState('');
  const [street, setStreet] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [instructions, setInstructions] = useState('');
  const [addressType, setAddressType] = useState<AddressType>('home');
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [locLoading, setLocLoading] = useState(false);
  const [locMessage, setLocMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function useCurrentLocation() {
    setLocMessage(null);
    setLocLoading(true);
    try {
      const Location = await import('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocMessage('Location permission denied. Enter your address manually.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLat(pos.coords.latitude);
      setLng(pos.coords.longitude);
      const places = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const p = places[0];
      if (p) {
        if (p.city) setCity(p.city);
        if (p.region) setState(p.region);
        if (p.postalCode) setPostalCode(p.postalCode.replace(/\D/g, '').slice(0, 6));
        if (p.street || p.name) setStreet(p.street ?? p.name ?? '');
      }
      setLocMessage('Location applied. Please confirm your house / flat details.');
    } catch {
      setLocMessage('Could not get location. Enter address manually.');
    } finally {
      setLocLoading(false);
    }
  }

  function validate(): boolean {
    const err: Record<string, string> = {};
    const nameForSave = useProfileName ? profileDisplayName : fullName.trim();
    if (nameForSave.length < 2) err.fullName = 'Enter your full name';
    if (house.trim().length < 2) err.house = 'Required';
    if (street.trim().length < 2) err.street = 'Required';
    if (city.trim().length < 2) err.city = 'Required';
    if (state.trim().length < 2) err.state = 'Required';
    if (!/^\d{6}$/.test(postalCode)) err.postalCode = 'Enter a valid 6-digit PIN code';
    setFieldErrors(err);
    return Object.keys(err).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setLoading(true);
    try {
      const created = await apiRequest<{
        line1: string;
        line2?: string;
        city: string;
        state: string;
        postalCode: string;
        lat?: number;
        lng?: number;
        phone?: string;
        label: string;
      }>('/customers/me/addresses', {
        method: 'POST',
        body: JSON.stringify({
          fullName: useProfileName ? profileDisplayName : fullName.trim(),
          line1: house.trim(),
          line2: street.trim(),
          landmark: landmark.trim() || undefined,
          city: city.trim(),
          state: state.trim(),
          postalCode: postalCode.trim(),
          phone: phone.trim() || undefined,
          addressType,
          deliveryInstructions: instructions.trim() || undefined,
          lat,
          lng,
          country: 'India',
        }),
      });
      const loc = addressToAppLocation({
        line1: created.line1,
        line2: created.line2,
        city: created.city,
        state: created.state,
        postalCode: created.postalCode,
        lat: created.lat,
        lng: created.lng,
        phone: created.phone,
        label: created.label,
      });
      await saveDeliveryLocation(loc);
      await qc.invalidateQueries({ queryKey: ['delivery-location'] });
      await invalidateAuthSession(qc);
      const pending = await loadPendingAddToCart();
      if (pending) {
        await clearPendingAddToCart();
        await startAddToCart(pending);
        setSaved(true);
        return;
      }
      setSaved(true);
      setTimeout(() => {
        afterAuthNavigate(false, typeof returnTo === 'string' ? returnTo : undefined);
      }, 700);
    } catch (e) {
      setFieldErrors({ form: e instanceof Error ? e.message : 'Could not save address' });
    } finally {
      setLoading(false);
    }
  }

  const types: AddressType[] = ['home', 'work', 'other'];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <ScreenHeader title="Delivery address" showBack layout="centered" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + 100 }}
        >
          <Text style={{ fontSize: 40, marginBottom: spacing.sm }}>📍</Text>
          <Text style={{ fontWeight: '800', fontSize: 24, color: theme.text }}>Where should we deliver?</Text>
          <Text style={{ color: theme.muted, marginTop: 8, lineHeight: 22, fontSize: 15 }}>
            Add your delivery address so we can show nearby stores and accurate delivery options.
          </Text>

          <Pressable
            onPress={useCurrentLocation}
            disabled={locLoading}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: spacing.lg,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: radius.md,
              borderWidth: 1.5,
              borderColor: theme.primary,
              backgroundColor: theme.successSoft,
            }}
          >
            {locLoading ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <Ionicons name="locate" size={20} color={theme.primary} />
            )}
            <Text style={{ fontWeight: '700', color: theme.primaryDark }}>Use my current location</Text>
          </Pressable>
          {locMessage ? <Text style={{ color: theme.muted, marginTop: 8, fontSize: 13 }}>{locMessage}</Text> : null}

          {useProfileName ? (
            <View style={{ marginTop: spacing.lg }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>Delivering to</Text>
              <Text style={{ marginTop: 6, fontSize: 16, fontWeight: '700', color: theme.primaryDark }}>
                {profileDisplayName}
              </Text>
            </View>
          ) : (
            <AuthFormField label="Full name" value={fullName} onChangeText={setFullName} error={fieldErrors.fullName} />
          )}
          <AuthFormField
            label="Mobile number"
            value={phone}
            onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
            keyboardType="number-pad"
            placeholder="10-digit mobile (optional if same as login)"
          />

          <Text style={{ marginTop: spacing.lg, fontSize: 13, fontWeight: '600' }}>Address type</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 8 }}>
            {types.map((t) => (
              <Pressable
                key={t}
                onPress={() => setAddressType(t)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: radius.full,
                  borderWidth: 1.5,
                  borderColor: addressType === t ? theme.primary : theme.border,
                  backgroundColor: addressType === t ? theme.successSoft : theme.surface,
                }}
              >
                <Text style={{ fontWeight: '700', textTransform: 'capitalize', color: addressType === t ? theme.primaryDark : theme.muted }}>
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>

          <AuthFormField label="House / Flat / Building" value={house} onChangeText={setHouse} error={fieldErrors.house} />
          <AuthFormField label="Street / Area" value={street} onChangeText={setStreet} error={fieldErrors.street} />
          <AuthFormField label="Landmark (optional)" value={landmark} onChangeText={setLandmark} />
          <AuthFormField label="City" value={city} onChangeText={setCity} error={fieldErrors.city} />
          <AuthFormField label="State" value={state} onChangeText={setState} error={fieldErrors.state} />
          <AuthFormField
            label="PIN code"
            value={postalCode}
            onChangeText={(t) => setPostalCode(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            error={fieldErrors.postalCode}
          />
          <AuthFormField
            label="Delivery instructions (optional)"
            value={instructions}
            onChangeText={setInstructions}
            multiline
            numberOfLines={3}
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />

          {fieldErrors.form ? <Text style={{ color: theme.discount, marginTop: spacing.md }}>{fieldErrors.form}</Text> : null}
          {saved ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.lg }}>
              <Ionicons name="checkmark-circle" size={22} color={theme.success} />
              <Text style={{ fontWeight: '700', color: theme.success }}>Address saved</Text>
            </View>
          ) : null}
        </ScrollView>

        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
            backgroundColor: theme.surface,
            borderTopWidth: 1,
            borderTopColor: theme.border,
          }}
        >
          <Pressable
            onPress={save}
            disabled={loading || saved}
            style={{
              backgroundColor: loading || saved ? theme.border : theme.primaryDark,
              paddingVertical: 16,
              borderRadius: radius.md,
              alignItems: 'center',
            }}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>Save address</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
