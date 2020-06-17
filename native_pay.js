import React, { createContext, useContext, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import tstripe from 'tipsi-stripe'

const NativePaymentContext = createContext({})

export function NativePaymentProvider(props) {
  const [npReady, setNpReady] = useState(false)
  const [npProcessing, setNpProcessing] = useState(false)
  const [npPrefer, setNpPrefer] = useState(true)
  const [payee, setPayee] = useState()
  const onProgress = props.onProgress ? props.onProgress : () => { }

  function npSetup (props) {
    const { publishableKey, merchantId, payeeName, preferNativePay = true } = props
    // Dev mode is determined by the publishableKey
    // The payeeName is used to identify the company/organization that is going to receive an Apple Pay(ment).
    if (!publishableKey || publishableKey.length <= 0) {
      throw 'Stripe public key not found. Please contact support.'
    }
    if (!merchantId || merchantId.length <= 0) {
      throw 'No merchantId found. Please contact support.'
    }
    if (!payeeName) {
      throw 'No payeeName found. Please contact support.'
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

  async function npStartPurchase(props) {
    const { productId, description, amount, isSubscription = false } = props
    if (!npReady) {
      onProgress({ event: 'np_not_setup', productId, amount, description, isSubscription })
      throw 'Native Pay not initialized. Please contact support.'
    }
    setNpProcessing(true)
    if (npPrefer) {
      try {
        const deviceSupportsNativePay = await tstripe.deviceSupportsNativePay()
        onProgress({ event: 'np_device_support', productId, amount, description, isSubscription, meta: { deviceSupportsNativePay } })
        const canMakeNativePayments = deviceSupportsNativePay && await tstripe.canMakeNativePayPayments()
        onProgress({ event: 'np_payment_capability', productId, amount, description, isSubscription, meta: { canMakeNativePayments } })
        if (canMakeNativePayments) {
          // Native Pay
          const { options, items } = getOptions(Platform.OS, amount, description)
          const stripePurchase = await tstripe.paymentRequestWithNativePay(options, items)
          onProgress({ event: 'np_token', productId, description, amount, isSubscription, meta: { stripePurchase } })
          if (stripePurchase?.tokenId) {
            return stripePurchase
          }
        }
      } catch (error) {
        // Fall back to card entry on any error, not just error.message === 'This device does not support Apple Pay'
        onProgress({ event: 'np_error', productId, amount, description, isSubscription, error })
        // setNpPrefer(false)
      }
    }
    // Card Entry Fallback
    onProgress({ event: 'cc_fallback', productId, description, amount, isSubscription })
    const stripePurchase = await tstripe.paymentRequestWithCardForm()
    onProgress({ event: 'cc_token', productId, description, amount, isSubscription, meta: { stripePurchase } })
    if (stripePurchase?.tokenId) {
      return stripePurchase
    } else {
      throw 'Could not get card token'
    }
  }

  function getAndroidOptions(amount, description) {
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

  function getIosOptions(amount, description) {
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

  function getOptions(platform, amount, description) {
    return platform === 'android' ? getAndroidOptions(amount, description) : getIosOptions(amount, description)
  }

  async function npEndProcessing() {
    setNpProcessing(false)
  }

  return (
    <NativePaymentContext.Provider value={{
      npReady,
      npSetup,
      npStartPurchase,
      npEndProcessing,
      npProcessing
    }}
    >{props.children}
    </NativePaymentContext.Provider>
  )
}

export function useNativePayments() {
  return useContext(NativePaymentContext)
}
