import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { api } from '@/services/api'
import { AddressInput, type AddressData } from '@/components/AddressInput'
import type { PackageCreate, PackageSize } from '@chaski/shared-types'

const PACKAGE_SIZES: { value: PackageSize; label: string; description: string }[] = [
  { value: 'small', label: 'Small', description: 'Fits in a backpack' },
  { value: 'medium', label: 'Medium', description: 'Fits in a car seat' },
  { value: 'large', label: 'Large', description: 'Needs trunk space' },
  { value: 'extra_large', label: 'Extra Large', description: 'Very large item' },
]

const WEIGHT_PRESETS = [
  { label: '< 1 kg', value: 0.5 },
  { label: '1-2 kg', value: 1.5 },
  { label: '2-5 kg', value: 3 },
  { label: '5-10 kg', value: 7 },
  { label: '10-20 kg', value: 15 },
  { label: '> 20 kg', value: 25 },
]

export default function CreatePackageScreen() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState<Partial<PackageCreate>>({
    description: '',
    size: 'small',
    weight_kg: 1,
    pickup_address: '',
    pickup_lat: 0,
    pickup_lng: 0,
    dropoff_address: '',
    dropoff_lat: 0,
    dropoff_lng: 0,
    pickup_contact_name: '',
    pickup_contact_phone: '',
    dropoff_contact_name: '',
    dropoff_contact_phone: '',
    price: undefined,
  })

  const [step, setStep] = useState(0) // 0: details, 1: locations, 2: review

  const createMutation = useMutation({
    mutationFn: (data: PackageCreate) => api.packagesAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] })
      Alert.alert(
        t('common.success'),
        t('packages.createSuccess'),
        [{ text: t('common.ok'), onPress: () => router.back() }]
      )
    },
    onError: (error: any) => {
      Alert.alert(
        t('common.error'),
        error.message || t('packages.createError')
      )
    },
  })

  const validateStep = (currentStep: number): boolean => {
    switch (currentStep) {
      case 0:
        if (!formData.description || formData.description.length < 1) {
          Alert.alert(t('common.error'), t('packages.descriptionRequired'))
          return false
        }
        if (!formData.weight_kg || formData.weight_kg <= 0) {
          Alert.alert(t('common.error'), t('packages.weightRequired'))
          return false
        }
        return true
      case 1:
        if (!formData.pickup_address || !formData.pickup_lat || !formData.pickup_lng) {
          Alert.alert(t('common.error'), t('packages.pickupAddressRequired'))
          return false
        }
        if (!formData.dropoff_address || !formData.dropoff_lat || !formData.dropoff_lng) {
          Alert.alert(t('common.error'), t('packages.dropoffAddressRequired'))
          return false
        }
        return true
      default:
        return true
    }
  }

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 2))
    }
  }

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 0))
  }

  const handleSubmit = () => {
    const submitData: PackageCreate = {
      description: formData.description!,
      size: formData.size!,
      weight_kg: formData.weight_kg!,
      pickup_address: formData.pickup_address!,
      pickup_lat: formData.pickup_lat!,
      pickup_lng: formData.pickup_lng!,
      dropoff_address: formData.dropoff_address!,
      dropoff_lat: formData.dropoff_lat!,
      dropoff_lng: formData.dropoff_lng!,
      pickup_contact_name: formData.pickup_contact_name || undefined,
      pickup_contact_phone: formData.pickup_contact_phone || undefined,
      dropoff_contact_name: formData.dropoff_contact_name || undefined,
      dropoff_contact_phone: formData.dropoff_contact_phone || undefined,
      price: formData.price,
    }

    createMutation.mutate(submitData)
  }

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[0, 1, 2].map((s) => (
        <View key={s} style={styles.stepRow}>
          <View
            style={[
              styles.stepCircle,
              s <= step && styles.stepCircleActive,
              s < step && styles.stepCircleCompleted,
            ]}
          >
            <Text
              style={[
                styles.stepNumber,
                s <= step && styles.stepNumberActive,
              ]}
            >
              {s < step ? '✓' : s + 1}
            </Text>
          </View>
          {s < 2 && (
            <View
              style={[
                styles.stepLine,
                s < step && styles.stepLineActive,
              ]}
            />
          )}
        </View>
      ))}
    </View>
  )

  const renderStep0 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('packages.packageDetails')}</Text>
      <Text style={styles.stepSubtitle}>{t('packages.description')}</Text>

      {/* Description */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>{t('packages.description')} *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.description}
          onChangeText={(text) => setFormData((prev) => ({ ...prev, description: text }))}
          placeholder={t('packages.descriptionPlaceholder')}
          multiline
          numberOfLines={3}
          maxLength={500}
        />
        <Text style={styles.charCount}>{formData.description?.length || 0}/500</Text>
      </View>

      {/* Package Size */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>{t('packages.size')} *</Text>
        <View style={styles.sizeGrid}>
          {PACKAGE_SIZES.map((size) => (
            <TouchableOpacity
              key={size.value}
              style={[
                styles.sizeCard,
                formData.size === size.value && styles.sizeCardActive,
              ]}
              onPress={() => setFormData((prev) => ({ ...prev, size: size.value }))}
            >
              <Text
                style={[
                  styles.sizeLabel,
                  formData.size === size.value && styles.sizeLabelActive,
                ]}
              >
                {size.label}
              </Text>
              <Text style={styles.sizeDescription}>{size.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Weight */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>{t('packages.weight')} *</Text>
        <View style={styles.weightPresets}>
          {WEIGHT_PRESETS.map((preset) => (
            <TouchableOpacity
              key={preset.value}
              style={[
                styles.presetChip,
                formData.weight_kg === preset.value && styles.presetChipActive,
              ]}
              onPress={() => setFormData((prev) => ({ ...prev, weight_kg: preset.value }))}
            >
              <Text
                style={[
                  styles.presetChipText,
                  formData.weight_kg === preset.value && styles.presetChipTextActive,
                ]}
              >
                {preset.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.weightInputRow}>
          <TextInput
            style={[styles.input, styles.weightInput]}
            value={String(formData.weight_kg || '')}
            onChangeText={(text) =>
              setFormData((prev) => ({ ...prev, weight_kg: parseFloat(text) || 0 }))
            }
            keyboardType="decimal-pad"
            placeholder="0.0"
          />
          <Text style={styles.weightUnit}>kg</Text>
        </View>
      </View>

      {/* Price (Optional) */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>{t('packages.suggestedPrice')} ({t('common.optional')})</Text>
        <View style={styles.priceInputRow}>
          <Text style={styles.currencySymbol}>$</Text>
          <TextInput
            style={[styles.input, styles.priceInput]}
            value={formData.price ? String(formData.price) : ''}
            onChangeText={(text) =>
              setFormData((prev) => ({
                ...prev,
                price: text ? parseFloat(text) : undefined,
              }))
            }
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
        </View>
        <Text style={styles.helperText}>{t('packages.priceHint')}</Text>
      </View>
    </View>
  )

  const handlePickupAddressSelect = (data: AddressData) => {
    setFormData((prev) => ({
      ...prev,
      pickup_address: data.address,
      pickup_lat: data.lat,
      pickup_lng: data.lng,
    }))
  }

  const handleDropoffAddressSelect = (data: AddressData) => {
    setFormData((prev) => ({
      ...prev,
      dropoff_address: data.address,
      dropoff_lat: data.lat,
      dropoff_lng: data.lng,
    }))
  }

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('packages.pickupLocation')}</Text>
      <Text style={styles.stepSubtitle}>{t('packages.locationDescription')}</Text>

      {/* Pickup Address */}
      <View style={{ zIndex: 3 }}>
        <AddressInput
          label={t('packages.pickupAddress')}
          placeholder={t('packages.enterAddress')}
          value={formData.pickup_address ? {
            address: formData.pickup_address,
            lat: formData.pickup_lat || 0,
            lng: formData.pickup_lng || 0,
          } : undefined}
          onAddressSelect={handlePickupAddressSelect}
          required
          type="pickup"
        />
      </View>

      {/* Pickup Contact */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>{t('packages.contactName')} ({t('common.optional')})</Text>
        <TextInput
          style={styles.input}
          value={formData.pickup_contact_name}
          onChangeText={(text) =>
            setFormData((prev) => ({ ...prev, pickup_contact_name: text }))
          }
          placeholder={t('packages.enterName')}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>{t('packages.contactPhone')} ({t('common.optional')})</Text>
        <TextInput
          style={styles.input}
          value={formData.pickup_contact_phone}
          onChangeText={(text) =>
            setFormData((prev) => ({ ...prev, pickup_contact_phone: text }))
          }
          placeholder={t('packages.enterPhone')}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.divider} />

      <Text style={styles.stepTitle}>{t('packages.deliveryLocation')}</Text>

      {/* Dropoff Address */}
      <View style={{ zIndex: 2 }}>
        <AddressInput
          label={t('packages.deliveryAddress')}
          placeholder={t('packages.enterAddress')}
          value={formData.dropoff_address ? {
            address: formData.dropoff_address,
            lat: formData.dropoff_lat || 0,
            lng: formData.dropoff_lng || 0,
          } : undefined}
          onAddressSelect={handleDropoffAddressSelect}
          required
          type="dropoff"
        />
      </View>

      {/* Dropoff Contact */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>{t('packages.contactName')} ({t('common.optional')})</Text>
        <TextInput
          style={styles.input}
          value={formData.dropoff_contact_name}
          onChangeText={(text) =>
            setFormData((prev) => ({ ...prev, dropoff_contact_name: text }))
          }
          placeholder={t('packages.enterName')}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>{t('packages.contactPhone')} ({t('common.optional')})</Text>
        <TextInput
          style={styles.input}
          value={formData.dropoff_contact_phone}
          onChangeText={(text) =>
            setFormData((prev) => ({ ...prev, dropoff_contact_phone: text }))
          }
          placeholder={t('packages.enterPhone')}
          keyboardType="phone-pad"
        />
      </View>
    </View>
  )

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('packages.reviewPackage')}</Text>
      <Text style={styles.stepSubtitle}>{t('packages.reviewDescription')}</Text>

      {/* Package Summary */}
      <View style={styles.reviewCard}>
        <Text style={styles.reviewSectionTitle}>{t('packages.packageDetails')}</Text>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>{t('packages.description')}:</Text>
          <Text style={styles.reviewValue}>{formData.description}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>{t('packages.size')}:</Text>
          <Text style={styles.reviewValue}>
            {PACKAGE_SIZES.find((s) => s.value === formData.size)?.label}
          </Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>{t('packages.weight')}:</Text>
          <Text style={styles.reviewValue}>{formData.weight_kg} kg</Text>
        </View>
        {formData.price !== undefined && (
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>{t('packages.suggestedPrice')}:</Text>
            <Text style={[styles.reviewValue, styles.priceValue]}>${formData.price.toFixed(2)}</Text>
          </View>
        )}
      </View>

      {/* Location Summary */}
      <View style={styles.reviewCard}>
        <Text style={styles.reviewSectionTitle}>{t('packages.route')}</Text>

        <View style={styles.routeContainer}>
          {/* Route Line Indicator */}
          <View style={styles.routeIndicator}>
            <View style={styles.pickupDot} />
            <View style={styles.routeLine} />
            <View style={styles.dropoffDot} />
          </View>

          {/* Addresses */}
          <View style={styles.routeAddresses}>
            <View style={styles.addressBlock}>
              <Text style={styles.addressLabel}>{t('packages.pickupAddress')}</Text>
              <Text style={styles.addressValue}>{formData.pickup_address || '-'}</Text>
              {formData.pickup_contact_name && (
                <Text style={styles.contactText}>
                  {formData.pickup_contact_name}
                  {formData.pickup_contact_phone && ` - ${formData.pickup_contact_phone}`}
                </Text>
              )}
            </View>

            <View style={[styles.addressBlock, styles.addressBlockEnd]}>
              <Text style={styles.addressLabel}>{t('packages.deliveryAddress')}</Text>
              <Text style={styles.addressValue}>{formData.dropoff_address || '-'}</Text>
              {formData.dropoff_contact_name && (
                <Text style={styles.contactText}>
                  {formData.dropoff_contact_name}
                  {formData.dropoff_contact_phone && ` - ${formData.dropoff_contact_phone}`}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  )

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
      >
        {renderStepIndicator()}

        {step === 0 && renderStep0()}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.buttonContainer}>
        {step > 0 && (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>{t('common.back')}</Text>
          </TouchableOpacity>
        )}

        {step < 2 ? (
          <TouchableOpacity
            style={[styles.nextButton, step === 0 && styles.nextButtonFull]}
            onPress={handleNext}
          >
            <Text style={styles.nextButtonText}>{t('common.next')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.submitButton, createMutation.isPending && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={createMutation.isPending}
          >
            <Text style={styles.submitButtonText}>
              {createMutation.isPending ? t('common.loading') : t('packages.createNew')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 40,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#3b82f6',
  },
  stepCircleCompleted: {
    backgroundColor: '#22c55e',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  stepNumberActive: {
    color: '#fff',
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: '#22c55e',
  },
  stepContent: {
    padding: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#111',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 4,
  },
  sizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  sizeCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
  },
  sizeCardActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  sizeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  sizeLabelActive: {
    color: '#3b82f6',
  },
  sizeDescription: {
    fontSize: 12,
    color: '#6b7280',
  },
  weightPresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  presetChipActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  presetChipText: {
    fontSize: 14,
    color: '#6b7280',
  },
  presetChipTextActive: {
    color: '#3b82f6',
    fontWeight: '500',
  },
  weightInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weightInput: {
    width: 100,
  },
  weightUnit: {
    fontSize: 16,
    color: '#6b7280',
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 18,
    color: '#6b7280',
    marginRight: 8,
  },
  priceInput: {
    width: 120,
  },
  helperText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 24,
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  reviewSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 12,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  reviewLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  reviewValue: {
    fontSize: 14,
    color: '#111',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  priceValue: {
    color: '#22c55e',
  },
  routeContainer: {
    flexDirection: 'row',
  },
  routeIndicator: {
    width: 24,
    alignItems: 'center',
    paddingTop: 4,
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
  },
  routeLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#d1d5db',
    marginVertical: 4,
    minHeight: 30,
  },
  dropoffDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
  },
  routeAddresses: {
    flex: 1,
    marginLeft: 12,
  },
  addressBlock: {
    paddingVertical: 4,
  },
  addressBlockEnd: {
    marginTop: 12,
  },
  addressLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  addressValue: {
    fontSize: 14,
    color: '#111',
    fontWeight: '500',
  },
  contactText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  backButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  nextButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#22c55e',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
})
