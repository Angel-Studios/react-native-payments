import {
  Platform
} from 'react-native'
import tstripe from 'tipsi-stripe'

setGlobal({
  native_pay_updates: [],
  native_pay_errors: [],
  native_pay_payee: 'Payee',
  native_pay_devmode: false,
  native_pay_prefer: true,
  native_pay_ready: false
})

export async function getUpdates () {
  const [npUpdates] = useGlobal('native_pay_updates')
  return npUpdates
}
export async function getErrors () {
  const [npErrors] = useGlobal('native_pay_errors')
  return npErrors
}
export async function afterComplete ({ purchase, error }) {
  if (purchase) {
    const deleteUpdate = useDispatch('delete_native_pay_update')
    deleteUpdate(purchase)
  }
  if (error) {
    const deleteError = useDispatch('delete_native_pay_error')
    deleteError(error)
  }
}

// Opens the Payment UI
export async function startNativePayment (props) {
  const { sku, description, amount, isSubscription = false } = props
  const { onProgress = () => {}, onSuccess = () => {}, onError = () => {}  } = props
  const [npReady] = useGlobal('native_pay_ready')
  const [npPrefer] = useGlobal('native_pay_prefer')
  const platformWord = (Platform.OS === 'ios') ? 'Apple' : 'Google'

  if (!npReady) {
    onProgress({ event: 'native_payments_no_init', sku, amount, description, isSubscription })
    onError({ message: 'Native Pay not initialized. Please contact support.' })
  }
  if (npPrefer) {
    try {
      const deviceSupportsNativePay = await tstripe.deviceSupportsNativePay()
      onProgress({ event: 'native_pay_device_supported', sku, amount, description, isSubscription, meta: { deviceSupportsNativePay } })
      const canMakeNativePayments = deviceSupportsNativePay && await tstripe.canMakeNativePayPayments()
      onProgress({ event: 'native_pay_configured', sku, amount, description, isSubscription, meta: { canMakeNativePayments } })
      if (canMakeNativePayments && npPrefer) {
        // Native Pay
        return await getNativePaymentToken(props)
       }
    } catch (error) {
      // Fall back to card entry on any error, not just error.message === 'This device does not support Apple Pay'
      onProgress({ event: 'native_pay_error', sku, amount, description, isSubscription, error })
    }
  }
  // Card Entry Fallback
  return await getCardPaymentToken(props, error='Unable to complete payment with the entered details.')
}

export default function InitializeNativePay (props) {
  const { publishableKey, merchantId, payee, preferNativePay = true } = props
  // Dev mode is determined by the publishableKey
  // The payee is used to identify the company/organization that is going to receive an Apple Pay(ment).

  const [, setNpPayee] = useGlobal('native_pay_payee')
  const [, setNpPrefer] = useGlobal('native_pay_prefer')
  const [, setNpDevmode] = useGlobal('native_pay_devmode')
  const [, setNpReady] = useGlobal('native_pay_ready')
  

  useEffect(() => {
    setNpPrefer(preferNativePay)

    if (!payee) {
      throw Error({ message: 'No payee found. Please contact support.' })
    }
    setNpPayee(payee)

    if (!publishableKey || publishableKey.length <= 0) {
      throw Error({ message: 'Stripe public key not found. Please contact support.' })
    }
  
    let androidPayMode = 'production'
    if (publishableKey.indexOf('_test_') > 0) {
      androidPayMode = 'test'
      setNpDevmode(true)
    }
  
    // Save the error so we can put it somewhere the user can see it and report on it.
    addReducer('save_native_pay_error', (global, dispatch, error) => ({
      native_pay_errors: [ ...global.native_pay_errors, error],
    }))
    addReducer('delete_native_pay_error', (global, dispatch, error) => ({
      native_pay_errors: [...global.native_pay_errors.filter(item => item !== error)],
    }))
  
    // Save the update in case we want to try again if our backend server was down/broken.
    // addReducer('save_native_pay_update', (global, dispatch, purchase) => ({
    //   native_pay_updates: [ ...global.native_pay_updates, purchase],
    // }))
    // addReducer('delete_native_pay_update', (global, dispatch, purchase) => ({
    //   native_pay_updates: [...global.native_pay_updates.filter(item => item !== purchase)],
    // }))
    onProgress({ event: 'native_pay_options_setting', meta: { publishableKey, androidPayMode, merchantId, payee } })
    tstripe.setOptions({
      publishableKey,
      androidPayMode, // Android only
      merchantId // For Apple
    })
    setNpReady(true)

    return () => {
      setNpReady(false)
    }
  }, [])
}

const getNativePaymentToken = async (props, error_message) => {
  // Native Pay
  const { sku, description, amount, isSubscription = false } = props
  const { onProgress = () => {}, onSuccess = () => {}, onError = () => {}  } = props
  onProgress({ event: 'native_pay_viewed_ui', sku, description, amount, isSubscription })
  const { options, items } = getOptions(Platform.OS, amount, description)
  const token = await tstripe.paymentRequestWithNativePay(options, items)
  onProgress({ event: 'native_pay_token_created', sku, description, amount, isSubscription, meta: { token } })
  if (!token?.tokenId) throw new Error('Could not get Native Pay token')
  onSuccess(token)
  return token
}

const getCardPaymentToken = async (amount, description, onProgress) => {
  // Card Entry
  const { sku, description, amount, isSubscription = false } = props
  const { onProgress = () => {}, onSuccess = () => {}, onError = () => {}  } = props
  onProgress({ event: 'credit_card_viewed_ui', sku, description, amount, isSubscription })
  const token = await tstripe.paymentRequestWithCardForm()
  onProgress({ event: 'credit_card_token_created', sku, description, amount, isSubscription, meta: { token } })
  if (!token?.tokenId) throw new Error('Could not get card token')
  onSuccess(token)
  return token
}

const getAndroidOptions = (amount, description) => {
  return {
    options: {
      // billing_address_required: true,
      // shipping_address_required: true,
      // phone_number_required: true,
      total_price: `${amount / 100}`,
      currency_code: 'USD',
      line_items: [{
        currency_code: 'USD',
        description: description,
        total_price: `${amount / 100}`,
        unit_price: `${amount / 100}`,
        quantity: '1'
      }]
    }
  }
}

const getIosOptions = (amount, description) => {
  const [npPayee] = useGlobal('native_pay_payee')
  return {
    options: {
      // requiredShippingAddressFields: ['name', 'email', 'phone'],
      // requiredBillingAddressFields: ['name', 'email', 'phone'],
      // requestPayerEmail: true,
      // requestPayerPhone: true,
      requestPayerName: true,
      requestShipping: false
    },
    items: [{
      label: description,
      amount: `${amount / 100}`
    },
    {
      label: npPayee, // Final item is the checkout summary
      amount: `${amount / 100}`
    }]
  }
}

const getOptions = (platform, amount, description) => {
  return platform === 'android' ? getAndroidOptions(amount, description) : getIosOptions(amount, description)
}
