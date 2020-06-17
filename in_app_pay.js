import React, { createContext, useContext, useEffect, useState } from 'react'
import { Platform } from 'react-native'
// import AsyncStorage from '@react-native-community/async-storage'
import {
  initConnection,
  getProducts,
  getSubscriptions,
  finishTransaction,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  requestSubscription
} from 'react-native-iap'

const InAppPaymentContext = createContext({})

export function InAppPaymentProvider (props) {
  const [iapReady, setIapReady] = useState(false)
  const [iapProcessing, setIapProcessing] = useState(false)
  const [iapUnfinished, setIapUnfinished] = useState(false)
  const [iapProducts, setIapProducts] = useState([])
  const [iapSubscriptions, setIapSubscriptions] = useState([])
  const onProgress = props.onProgress ? props.onProgress : () => { }
  // let listeners

  useEffect(() => {
    if (Platform.OS !== 'ios') return
    const simpleListeners = [
      purchaseUpdatedListener(async (purchase) => {
        onProgress({ event: 'iap_listener_update', meta: { purchase } })
        setIapUnfinished(true)
      }),
      purchaseErrorListener(async (error) => {
        onProgress({ event: 'iap_listener_error', meta: { error } })
        setIapUnfinished(true)
      })
    ]
    return () => {
      if (simpleListeners) simpleListeners.map(listener => listener.remove())
      // if (listeners) listeners.map(listener => listener.remove())
    }
  }, [])

  async function iapSetup (props) {
    const { productIds, subscriptionIds } = props
    // if (props.onProgress) onProgress = props.onProgress
    // if (props.onSuccess) onSuccess = props.onSuccess
    onProgress({ event: 'iap_setup', meta: { productIds, subscriptionIds } })
    if (Platform.OS === 'ios') {
      initConnection()
      let noItems = true
      if (productIds) {
        const startTime = Date.now()
        const products = await getProducts(productIds)
        if (products.length > 0) noItems = false
        onProgress({ event: 'iap_setup_products', meta: { products, elapsed: (Date.now() - startTime), productIds } })
        setIapProducts(products)
      }
      if (subscriptionIds) {
        const startTime = Date.now()
        const subscriptions = await getSubscriptions(subscriptionIds)
        if (subscriptions.length > 0) noItems = false
        onProgress({ event: 'iap_setup_subscriptions', meta: { subscriptions, elapsed: (Date.now() - startTime), subscriptionIds } })
        setIapSubscriptions(subscriptions)
      }
      // It seems getProducts,getSubscriptions must complete before requestPurchase
      // or the user could get charged but we only see an error.
      // if (!listeners) {
        // listeners = [
        //   purchaseUpdatedListener(async (purchase) => {
        //     // Expect results something like this:
        //     // {
        //     //   "purchase": {
        //     //     "productId": "vidangel_riot_0015",
        //     //     "transactionId": "1000000673323302",
        //     //     "transactionDate": 1591039683000,
        //     //     "transactionReceipt": "..."
        //     //   }
        //     // }
        //     // More detail is available in a query for all previous purchases
        //     console.log('purchaseUpdatedListener', { purchase })
        //     onProgress({ event: 'iap_update', meta: { purchase } })
        //     const receipt = purchase.transactionReceipt
        //     if (receipt) {
        //       try {
        //         const { productId, amount, description, isSubscription } = await getInAppPaymentDataAsync()
        //         onSuccess({ productId, amount, description, isSubscription, purchase })
        //         await finishTransaction(purchase)
        //         setIapUnfinished(false)
        //       } catch (iapError) {
        //         onProgress({ event: 'iap_update_error', meta: { iapError: iapError.message } })
        //       }
        //     }
        //   }),
        //   purchaseErrorListener(async (error) => {
        //     onProgress({ event: 'iap_error', meta: { error } })
        //   })
        // ]
      // }
      if (!noItems) {
        onProgress({ event: 'iap_ready' })
        setIapReady(true)
      }
    }
  }
  async function iapStartPurchase(props) {
    // updateInAppPaymentDataAsync(props)
    const { productId, amount, description, isSubscription = false } = props

    if (!iapReady) {
      onProgress({ event: 'iap_early_purchase', productId, amount, description, isSubscription })
      throw 'In-app payments have not been initialized. Please contact support.'
    }
    if (iapProcessing) {
      onProgress({ event: 'iap_already_processing', productId, amount, description, isSubscription })
      throw 'In-app payment already in progress. Please contact support if this happens again tomorrow.'
    }
    // TODO: Check for productId in in_app_pay_products and in_app_pay_subscriptions
    // throw 'Apple productId not set up in initialization. Please contact the developers.'


    setIapProcessing(true)
    if (!isSubscription) {
      onProgress({ event: 'iap_requesting_purchase', productId, amount, description, isSubscription })
      const purchase = await requestPurchase(productId, false)
      onProgress({ event: 'iap_requested_purchase', productId, amount, description, isSubscription, meta: { purchase } })
      return purchase
    } else {
      onProgress({ event: 'iap_requesting_subscription', productId, amount, description, isSubscription })
      const subscription = await requestSubscription(productId, false)
      onProgress({ event: 'iap_requested_subscription', productId, amount, description, isSubscription, meta: { subscription } })
      return subscription
    }
    // The 'false' above means you should call iapEndPurchase once the purchase is successfully recorded in our backend database
    // Otherwise purchaseUpdatedListener and/or purchaseErrorListener will retrigger for those purchases each time the app restarts.
  }
  async function iapEndPurchase(purchase) {
    await finishTransaction(purchase)
    setIapProcessing(false)
  }

  async function iapEndProcessing() {
    setIapProcessing(false)
  }

  return (
    <InAppPaymentContext.Provider value={{
      iapReady,
      iapSetup,
      iapUnfinished,
      iapProducts,
      iapSubscriptions,
      iapStartPurchase,
      iapEndPurchase,
      iapEndProcessing,
      iapProcessing
    }}
    >{props.children}
    </InAppPaymentContext.Provider>
  )
}

export function useInAppPayments () {
  return useContext(InAppPaymentContext)
}

// Tradeoff: Using AsyncStorage directly in this file reduces files touched => faster development
// Unless there is a namespace conflict, so use fRP77G to reduce the chance for a naming conflict.
// const IAPSETTINGS = 'in_app_payment_fRP77G'
// const updateInAppPaymentDataAsync = async (meta) => {
//   // TODO: Store this in the database so it survives an app uninstall?
//   const iapSettings = await AsyncStorage.getItem(IAPSETTINGS)
//   const json = { ...(JSON.parse(iapSettings)), ...(meta) }
//   if (meta) {
//     await AsyncStorage.setItem(IAPSETTINGS, JSON.stringify(json))
//   }
//   return json
// }
// export const getInAppPaymentDataAsync = async () => {
//   // TODO: Store this in the database so it survives an app uninstall?
//   const iapSettings = await AsyncStorage.getItem(IAPSETTINGS)
//   const json = { ...(JSON.parse(iapSettings)) }
//   return json
// }
// const clearInAppPaymentDataAsync = async () => {
//   await AsyncStorage.removeItem(IAPSETTINGS)
// }
