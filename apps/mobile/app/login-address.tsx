import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { useDeliveryAddress } from '../lib/useDeliveryAddress';

type AddressType = 'home' | 'work' | 'other';

type SavedAddress = {
  _id: string;
  label: string;
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  phone?: string;
  addressType?: AddressType;
  lat?: number;
  lng?: number;
  isDefault?: boolean;
};

export default function LoginAddressScreen() {
  const { startAddToCart } = useAddToCartFlow();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const auth = useAuthSession();
  const { location: activeLocation } = useDeliveryAddress();

  const [showForm, setShowForm] = useState(false);
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
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const addresses = useQuery({
    queryKey: ['customer-addresses'],
    queryFn: () => apiRequest<SavedAddress[]>('/customers/me/addresses'),
    enabled: auth.signedIn,
    retry: false,
  });

  const list = addresses.data ?? [];
  const needsForm = showForm || (!addresses.isLoading && list.length === 0);
  const footerPad = Math.max(insets.bottom, 8) + spacing.md;
  const title = needsForm ? (list.length ? 'Add address' : 'Delivery address') : 'Saved addresses';

  async function useCurrentLocation() {
    setLocMessage(null);
    setLocLoading(true);
    try {
      const current = await Location.getForegroundPermissionsAsync();
      let status = current.status;
      let canAskAgain = current.canAskAgain;

      if (status !== 'granted') {
        const requested = await Location.requestForegroundPermissionsAsync();
        status = requested.status;
        canAskAgain = requested.canAskAgain;
      }

      if (status !== 'granted') {
        setLocMessage(
          canAskAgain === false
            ? 'Location is blocked. Enable it in Settings, or enter address manually.'
            : 'Location permission denied. Enter your address manually.',
        );
        if (canAskAgain === false) {
          Alert.alert(
            'Location permission needed',
            'Enable location access in your device settings to auto-fill your address.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
          );
        }
        return;
      }

      const servicesOn = await Location.hasServicesEnabledAsync();
      if (!servicesOn) {
        setLocMessage('Turn on device location / GPS, then try again.');
        Alert.alert('Location is off', 'Please turn on Location / GPS in your device settings.', [
          { text: 'OK', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
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
        if (!house.trim() && p.name && p.name !== p.street) setHouse(p.name);
      }
      setLocMessage('Location applied. Confirm house / flat details.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setLocMessage(
        msg.toLowerCase().includes('permission')
          ? 'Location permission denied. Enter your address manually.'
          : 'Could not get location. Enter address manually.',
      );
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
    if (!/^\d{6}$/.test(postalCode)) err.postalCode = 'Enter a valid 6-digit PIN';
    setFieldErrors(err);
    return Object.keys(err).length === 0;
  }

  async function selectAddress(addr: SavedAddress) {
    setSelectingId(addr._id);
    try {
      const loc = addressToAppLocation({
        line1: addr.line1,
        line2: addr.line2,
        city: addr.city,
        state: addr.state,
        postalCode: addr.postalCode,
        lat: addr.lat,
        lng: addr.lng,
        phone: addr.phone,
        label: addr.label,
      });
      await saveDeliveryLocation(loc);
      await qc.invalidateQueries({ queryKey: ['delivery-location'] });
      afterAuthNavigate(false, typeof returnTo === 'string' ? returnTo : '/(tabs)/account');
    } finally {
      setSelectingId(null);
    }
  }

  async function save() {
    if (!validate()) return;
    setLoading(true);
    try {
      const created = await apiRequest<SavedAddress>('/customers/me/addresses', {
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
      await qc.invalidateQueries({ queryKey: ['customer-addresses'] });
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
  const fieldStyle = {
    backgroundColor: theme.white,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 11,
    fontSize: 14,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader
        title={title}
        showBack
        layout="centered"
        onBack={
          needsForm && list.length > 0
            ? () => {
                setShowForm(false);
                setFieldErrors({});
              }
            : undefined
        }
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {!needsForm ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.sm,
              paddingBottom: 88 + footerPad,
              gap: spacing.sm,
            }}
          >
            <Text style={{ fontSize: 12, color: theme.muted, paddingHorizontal: 2, marginBottom: 2 }}>
              Tap an address to use it for delivery
            </Text>

            {addresses.isLoading ? (
              <ActivityIndicator color={theme.primary} style={{ marginTop: 24 }} />
            ) : (
              list.map((addr) => {
                const selected =
                  activeLocation?.line1 === addr.line1 && activeLocation?.city === addr.city;
                const busy = selectingId === addr._id;
                return (
                  <Pressable
                    key={addr._id}
                    onPress={() => selectAddress(addr)}
                    disabled={Boolean(selectingId)}
                    style={[
                      styles.card,
                      selected ? { borderColor: theme.bannerBg } : null,
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          backgroundColor: selected ? theme.bannerBg : theme.neutralSoft,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {busy ? (
                          <ActivityIndicator size="small" color={selected ? theme.white : theme.primary} />
                        ) : (
                          <Ionicons
                            name={
                              addr.addressType === 'work'
                                ? 'briefcase-outline'
                                : addr.addressType === 'other'
                                  ? 'location-outline'
                                  : 'home-outline'
                            }
                            size={18}
                            color={selected ? theme.white : theme.primary}
                          />
                        )}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontWeight: '800', fontSize: 13, color: theme.text }}>
                            {addr.label || 'Address'}
                          </Text>
                          {addr.isDefault ? (
                            <View
                              style={{
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: radius.full,
                                backgroundColor: theme.successSoft,
                              }}
                            >
                              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.success }}>
                                Default
                              </Text>
                            </View>
                          ) : null}
                          {selected ? (
                            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.bannerBg }}>
                              In use
                            </Text>
                          ) : null}
                        </View>
                        <Text style={{ fontSize: 12, color: theme.muted, marginTop: 3, lineHeight: 17 }}>
                          {[addr.line1, addr.line2, addr.city, addr.state, addr.postalCode]
                            .filter(Boolean)
                            .join(', ')}
                        </Text>
                        {addr.phone ? (
                          <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{addr.phone}</Text>
                        ) : null}
                      </View>
                      <Ionicons
                        name={selected ? 'checkmark-circle' : 'chevron-forward'}
                        size={18}
                        color={selected ? theme.bannerBg : theme.muted}
                      />
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.sm,
              paddingBottom: 100 + footerPad,
              gap: spacing.sm,
            }}
          >
            <View style={styles.card}>
              <Text style={{ fontWeight: '800', fontSize: 15, color: theme.text }}>Where should we deliver?</Text>
              <Text style={{ color: theme.muted, marginTop: 4, fontSize: 12, lineHeight: 17 }}>
                Add a delivery address for nearby restaurants and accurate delivery.
              </Text>

              <Pressable
                onPress={useCurrentLocation}
                disabled={locLoading}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginTop: 12,
                  paddingVertical: 10,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: theme.border,
                  backgroundColor: theme.neutralSoft,
                }}
              >
                {locLoading ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Ionicons name="locate" size={16} color={theme.primary} />
                )}
                <Text style={{ fontWeight: '700', fontSize: 13, color: theme.primary }}>
                  Use current location
                </Text>
              </Pressable>
              {locMessage ? (
                <Text style={{ color: theme.muted, marginTop: 8, fontSize: 11 }}>{locMessage}</Text>
              ) : null}
            </View>

            <SectionLabel>Contact</SectionLabel>
            <View style={styles.card}>
              {useProfileName ? (
                <View>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted }}>Delivering to</Text>
                  <Text style={{ marginTop: 4, fontSize: 14, fontWeight: '700', color: theme.text }}>
                    {profileDisplayName}
                  </Text>
                </View>
              ) : (
                <AuthFormField
                  label="Full name"
                  value={fullName}
                  onChangeText={setFullName}
                  error={fieldErrors.fullName}
                  style={fieldStyle}
                />
              )}
              <AuthFormField
                label="Mobile number"
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                keyboardType="number-pad"
                placeholder="10-digit mobile (optional)"
                style={fieldStyle}
              />
            </View>

            <SectionLabel>Address type</SectionLabel>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {types.map((t) => {
                const selected = addressType === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setAddressType(t)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: radius.sm,
                      borderWidth: 1,
                      borderColor: selected ? theme.bannerBg : theme.border,
                      backgroundColor: selected ? theme.bannerBg : theme.white,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: '700',
                        fontSize: 12,
                        textTransform: 'capitalize',
                        color: selected ? theme.white : theme.tabChipInk,
                      }}
                    >
                      {t}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <SectionLabel>Address details</SectionLabel>
            <View style={[styles.card, { gap: 0 }]}>
              <AuthFormField
                label="House / Flat / Building"
                value={house}
                onChangeText={setHouse}
                error={fieldErrors.house}
                style={fieldStyle}
              />
              <AuthFormField
                label="Street / Area"
                value={street}
                onChangeText={setStreet}
                error={fieldErrors.street}
                style={fieldStyle}
              />
              <AuthFormField
                label="Landmark (optional)"
                value={landmark}
                onChangeText={setLandmark}
                style={fieldStyle}
              />
              <AuthFormField
                label="City"
                value={city}
                onChangeText={setCity}
                error={fieldErrors.city}
                style={fieldStyle}
              />
              <AuthFormField
                label="State"
                value={state}
                onChangeText={setState}
                error={fieldErrors.state}
                style={fieldStyle}
              />
              <AuthFormField
                label="PIN code"
                value={postalCode}
                onChangeText={(t) => setPostalCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                error={fieldErrors.postalCode}
                style={fieldStyle}
              />
              <AuthFormField
                label="Delivery instructions (optional)"
                value={instructions}
                onChangeText={setInstructions}
                multiline
                numberOfLines={3}
                style={[fieldStyle, { minHeight: 72, textAlignVertical: 'top' }]}
              />
            </View>

            {fieldErrors.form ? (
              <Text style={{ color: theme.discount, fontSize: 12, fontWeight: '600' }}>{fieldErrors.form}</Text>
            ) : null}
            {saved ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                <Text style={{ fontWeight: '700', fontSize: 13, color: theme.success }}>Address saved</Text>
              </View>
            ) : null}
          </ScrollView>
        )}

        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.tabBarBg,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.tabBarBorder,
            paddingHorizontal: spacing.lg,
            paddingTop: 8,
            paddingBottom: footerPad,
          }}
        >
          {needsForm ? (
            <Pressable
              onPress={save}
              disabled={loading || saved}
              style={{
                backgroundColor: loading || saved ? theme.border : theme.bannerBg,
                paddingVertical: 13,
                borderRadius: radius.sm,
                alignItems: 'center',
                opacity: loading || saved ? 0.7 : 1,
              }}
            >
              {loading ? (
                <ActivityIndicator color={theme.white} />
              ) : (
                <Text style={{ color: theme.white, fontWeight: '700', fontSize: 14 }}>Save address</Text>
              )}
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setShowForm(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: theme.bannerBg,
                paddingVertical: 13,
                borderRadius: radius.sm,
              }}
            >
              <Ionicons name="add" size={18} color={theme.white} />
              <Text style={{ color: theme.white, fontWeight: '700', fontSize: 14 }}>Add new address</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '800',
        color: theme.muted,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        marginTop: 4,
        marginBottom: 2,
        paddingHorizontal: 2,
      }}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.white,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});
