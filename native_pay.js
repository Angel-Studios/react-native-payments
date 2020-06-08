import {
  Platform
} from 'react-native'
import { useState } from 'react'
import tstripe from 'tipsi-stripe'

export default function useNativePayments(props) {
  const { onProgress = () => { } } = props
  const [npReady, setNpReady] = useState(false)
  const [npPrefer, setNpPrefer] = useState(true)
  const [payee, setPayee] = useState()
  const npSetup = (props) => {
    const { publishableKey, merchantId, payeeName, preferNativePay = true } = props
    // Dev mode is determined by the publishableKey
    // The payeeName is used to identify the company/organization that is going to receive an Apple Pay(ment).
    if (!publishableKey || publishableKey.length <= 0) {
      throw Error({ message: 'Stripe public key not found. Please contact support.' })
    }
    if (!merchantId || merchantId.length <= 0) {
      throw Error({ message: 'No merchantId found. Please contact support.' })
    }
    if (!payeeName) {
      throw Error({ message: 'No payeeName found. Please contact support.' })
    }
    setPayee(payeeName)
    let androidPayMode = 'production'
    if (publishableKey.indexOf('_test_') > 0) {
      androidPayMode = 'test'
    }
    onProgress({ event: 'np_setup', meta: { publishableKey, androidPayMode, merchantId, payee: payeeName } })
    tstripe.setOptions({
      publishableKey,
      androidPayMode, // Android only
      merchantId // For Apple
    })
    setNpReady(true)
  }

  async function npStartPurchase (props) {
    const { sku, description, amount, isSubscription = false } = props
    const { onSuccess = () => { }, onError = () => { } } = props

    if (!npReady) {
      onProgress({ event: 'np_not_setup', sku, amount, description, isSubscription })
      onError({ message: 'Native Pay not initialized. Please contact support.' })
    }
    if (npPrefer) {
      try {
        const deviceSupportsNativePay = await tstripe.deviceSupportsNativePay()
        onProgress({ event: 'np_device_support', sku, amount, description, isSubscription, meta: { deviceSupportsNativePay } })
        const canMakeNativePayments = deviceSupportsNativePay && await tstripe.canMakeNativePayPayments()
        onProgress({ event: 'np_payment_capability', sku, amount, description, isSubscription, meta: { canMakeNativePayments } })
        if (canMakeNativePayments) {
          // Native Pay
          const { options, items } = getOptions(Platform.OS, amount, description)
          const stripePurchase = await tstripe.paymentRequestWithNativePay(options, items)
          onProgress({ event: 'np_token', sku, description, amount, isSubscription, meta: { stripePurchase } })
          if (stripePurchase?.tokenId) {
            onSuccess({ sku, description, amount, isSubscription, stripePurchase, item: props.item })
            return stripePurchase
          }
        }
      } catch (error) {
        // Fall back to card entry on any error, not just error.message === 'This device does not support Apple Pay'
        onProgress({ event: 'np_error', sku, amount, description, isSubscription, error })
        // setNpPrefer(false)
      }
    }
    // Card Entry Fallback
    onProgress({ event: 'cc_fallback', sku, description, amount, isSubscription })
    const stripePurchase = await tstripe.paymentRequestWithCardForm()
    onProgress({ event: 'cc_token', sku, description, amount, isSubscription, meta: { stripePurchase } })
    if (stripePurchase?.tokenId) {
      onSuccess({ sku, description, amount, isSubscription, stripePurchase, item: props.item })
      return stripePurchase
    } else {
      onError({ message: 'Could not get card token' })
    }
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
        label: payee, // Final item is the checkout summary
        amount: `${amount / 100}`
      }]
    }
  }

  const getOptions = (platform, amount, description) => {
    return platform === 'android' ? getAndroidOptions(amount, description) : getIosOptions(amount, description)
  }

  return { npReady, npSetup, npStartPurchase, npProcessing: false }
}

