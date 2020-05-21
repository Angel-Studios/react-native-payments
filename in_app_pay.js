import { useEffect, Platform } from 'react'
import { useGlobal, setGlobal, addReducer, useDispatch } from 'reactn'
import AsyncStorage from '@react-native-community/async-storage'
import {
  getProducts,
  getSubscriptions,
  finishTransaction,
  finishTransactionIOS,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  requestSubscription
} from 'react-native-iap'

// Tradeoff: Using AsyncStorage directly in this file reduces files touched => faster development
// Unless there is a namespace conflict, so use fRP77G to reduce the chance for a naming conflict.
const IAPSETTINGS = 'in_app_payment_fRP77G'
const updateInAppPaymentDataAsync = async (meta) => {
  // TODO: Store this in the database so it survives an app uninstall?
  const iapSettings = await AsyncStorage.getItem(IAPSETTINGS)
  const json = { ...(JSON.parse(iapSettings)), ...(meta) }
  if (meta) {
    await AsyncStorage.setItem(IAPSETTINGS, JSON.stringify(json))
  }
  return json
}
export const getInAppPaymentDataAsync = async () => {
  // TODO: Store this in the database so it survives an app uninstall?
  const iapSettings = await AsyncStorage.getItem(IAPSETTINGS)
  const json = { ...(JSON.parse(iapSettings)) }
  return json
}
const clearInAppPaymentDataAsync = async () => {
  await AsyncStorage.removeItem(IAPSETTINGS)
}

setGlobal({
  in_app_pay_processing: false,
  in_app_pay_listeners: [],

  in_app_pay_callbacks: {},
  in_app_pay_products: [],
  in_app_pay_subscriptions: [],
  in_app_pay_errors: [],
  in_app_pay_ready: null
})

export default function useInAppPayments (props) {
  const { appleIds } = props

  const [iapProcessing, setIapProcessing] = useGlobal('in_app_pay_processing')
  const [iapListeners, setIapListeners] = useGlobal('in_app_pay_listeners')

  const [iapReady, setIapReady] = useGlobal('in_app_pay_ready')

  const [iapErrors] = useGlobal('in_app_pay_errors')

  const [iapProducts, setIapProducts] = useGlobal('in_app_pay_products')
  const [iapSubscriptions, setIapSubscriptions] = useGlobal('in_app_pay_subscriptions')

  // For now this will only get called for the first use of UseInAppPayments
  const { onProgress = () => {} } = props

  const processNewPayment = async (payment) => {
    await updateInAppPaymentDataAsync(payment)
    setIapProcessing(false)
  }
  const setup = async ({ productIds, subscriptionIds }) => {
    console.log('setup', { productIds, subscriptionIds })
    if (productIds && !iapReady) {
      const startTime = Date.now()
      const products = await getProducts(productIds)
      onProgress({ event: 'iap_got_products', meta: { products, elapsed: (Date.now() - startTime), productIds } })
      setIapProducts(products)
    }
    if (subscriptionIds && !iapReady) {
      const startTime = Date.now()
      const subscriptions = await getSubscriptions(subscriptionIds)
      onProgress({ event: 'iap_got_subscriptions', meta: { subscriptions, elapsed: (Date.now() - startTime), subscriptionIds } })
      setIapSubscriptions(subscriptions)
    }
    // It seems getProducts,getSubscriptions must complete before requestPurchase or the user could get charged but we only see an error.
  }

  // Save the error so we can put it somewhere the user can see it and report on it.
  addReducer('save_in_app_pay_error', (global, dispatch, error) => ({
    in_app_pay_errors: [...global.in_app_pay_errors, error]
  }))
  addReducer('delete_in_app_pay_error', (global, dispatch, error) => ({
    in_app_pay_errors: [...global.in_app_pay_errors.filter(item => item !== error)]
  }))

  // // Make it so we can catch individual purchases and route them to the proper callback
  // addReducer('save_in_app_pay_callbacks', (global, dispatch, sku, callbacks) => ({
  //   in_app_pay_callbacks: { ...global.in_app_pay_callbacks, [sku]: callbacks }
  // }))
  // addReducer('delete_in_app_pay_callbacks', (global, dispatch, sku) => {
  //   const { [sku]: _, ...newCallBacks } = global.in_app_pay_callbacks
  //   return { in_app_pay_callbacks: newCallBacks }
  // })

  useEffect(() => {
    console.log({ appleIds })
    if (appleIds) {
      setup(appleIds)
    }
  }, [appleIds])

  useEffect(() => {
    console.log({ iapListeners: iapListeners.length, iapProducts, iapSubscriptions })
    if (iapListeners.length === 2 && (iapProducts.length || iapSubscriptions.length)) {
      console.log('iapReady')
      setIapReady(true)
    }
  }, [iapListeners, iapProducts, iapSubscriptions])

  useEffect(() => {
    // Apple doesn't give an immediate response to purchases, so we need to listen for them.
    // But we don't want multiple listeners at once, or they both get each event.
    if (iapListeners.length === 0) {
      setIapListeners([
        purchaseUpdatedListener(async (purchase) => {
          console.log({ purchase })
          onProgress({ event: 'in_app_pay_update', meta: { purchase } })
          const receipt = purchase.transactionReceipt
          if (receipt) {
            try {
              await processNewPayment(purchase)
              if (Platform.OS === 'ios') {
                finishTransactionIOS(purchase.transactionId)
              }
              await finishTransaction(purchase)
            } catch (iapError) {
              console.log({ iapError })
              onProgress({ event: 'iap_error', meta: { iapError } })
            }
          }

          // // const saveUpdate = useDispatch('save_in_app_pay_update')
          // // saveUpdate(purchase)
          // console.log('purchase', purchase)
          // const { sku } = purchase
          // const [iapCallbacks] = useGlobal('in_app_pay_callbacks')
          // if (sku in iapCallbacks) {
          //   const { onProgress, onSuccess, amount, description, isSubscription } = iapCallbacks[sku]
          //   onProgress({ event: 'in_app_pay_update', sku, amount, description, isSubscription, meta: { purchase } })
          //   onSuccess(purchase)
          //   const deleteCallbacks = useDispatch('delete_in_app_pay_callbacks')
          //   deleteCallbacks(sku)
          // } else {
          //   onProgress({ event: 'in_app_pay_update', meta: { purchase } })
          // }
          // // The purchase will come through the listener each time it is started
          // // until RNIap.finishTransaction is called (see afterComplete)
        }),
        purchaseErrorListener(async (error) => {
          console.log({ error })
          // const saveError = useDispatch('save_in_app_pay_error')
          // saveError(error)
          // onProgress({ event: 'iap_error', meta: { error } })
          // TODO: can I get the sku from the error for the callbacks? If we don't get it, call all onError callbacks
          // const [iapCallbacks] = useGlobal('in_app_pay_callbacks')
          // if (iapCallbacks.hasOwnProperty(sku)) {
          //   iapCallbacks[sku].onProgress({ event: 'purchaseError', error })
          //   iapCallbacks[sku].onError(error)
          //   const deleteCallbacks = useDispatch('delete_in_app_pay_callbacks')
          //   deleteCallbacks(sku)
          // }
        })
      ])
    }
    return () => {
      // This stuff could get run multiple times without problems
      setIapReady(false)
      iapListeners.map(listener => listener.remove())
      setIapListeners([])
    }
  }, [])

  // // We have to get more details from Apple for all skus that we might use,
  // // or we might charge them and return an error instead of fulfilling their order
  // async function setupInAppPayment (props) {
  //   const { productIds, subscriptionIds } = props
  //   // eslint-disable-next-line no-undef
  //   const { devMode = !!__DEV__ } = props
  //   const { onProgress = () => {} } = props
  //   const productSkus = (devMode) ? ['android.test.purchased'] : productIds
  //   const subscriptionSkus = (devMode) ? [] : subscriptionIds

  //   // It might be useful to use the following globals in the UI
  //   const [, setIapReady] = useGlobal('in_app_pay_ready')
  //   const [, setIapProducts] = useGlobal('in_app_pay_products')
  //   const [, setIapSubscriptions] = useGlobal('in_app_pay_subscriptions')

  //   let products = []
  //   if (productSkus.length > 0) {
  //     const startTime = Date.now()
  //     products = await RNIap.getProducts(productSkus)
  //     onProgress({ event: 'iap_got_products', meta: { products, elapsed: (Date.now() - startTime), productSkus } })
  //   }
  //   setIapProducts(products)
  //   let subscriptions = []
  //   if (subscriptionSkus.length > 0) {
  //     const startTime = Date.now()
  //     subscriptions = await RNIap.getSubscriptions(subscriptionSkus)
  //     onProgress({ event: 'iap_got_subscriptions', meta: { subscriptions, elapsed: (Date.now() - startTime), subscriptionSkus } })
  //   }
  //   setIapSubscriptions(subscriptions)
  //   // RNIap.getProducts,getSubscriptions must complete before RNIap.requestPurchase or the user could get charged but we only see an error.
  //   setIapReady(true)
  // }

  async function startInAppPayment (props) {
    console.log({ props })
    updateInAppPaymentDataAsync(props)
    const { sku, amount, description, isSubscription = false } = props
    const { onProgress = () => {}, onSuccess = () => {}, onError = () => {} } = props
    // // const saveCallbacks = useDispatch('save_in_app_pay_callbacks')
    // // saveCallbacks(sku, { onProgress, onSuccess, onError, sku, amount, description, isSubscription })

    if (iapReady) {
      // TODO: Check for sku in in_app_pay_products and in_app_pay_subscriptions
      // onError({ message: 'Apple product sku not set up in initialization. Please contact the developers.' })
      try {
        if (!isSubscription) {
          onProgress({ event: 'in_app_pay_requesting_purchase', sku, amount, description, isSubscription })
          await requestPurchase(sku, false)
        } else {
          onProgress({ event: 'in_app_pay_requesting_subscription', sku, amount, description, isSubscription })
          await requestSubscription(sku, false)
        }
        // The 'false' above means you should call afterComplete once the purchase is successfully recorded in our backend database
        // Otherwise purchaseUpdatedListener and/or purchaseErrorListener will retrigger for those purchases each time the app restarts.
      } catch (error) {
        onError(error)
      }
    } else if (iapReady === null) {
      onError({ message: 'In-app payments have not been initialized. Please contact support.' })
    } else {
      // I'm not sure what the format should be for errors, please adjust if you have something better
      onError({ message: 'In-app payments are not ready yet. Please try again in a minute or two, then if it still is not working, restart your app.' })
    }
  }
  async function finishInAppPayment ({ purchase, error }) {
    // if (purchase) {
    //   const deleteUpdate = useDispatch('delete_in_app_pay_update')
    //   deleteUpdate(purchase)
    //   RNIap.finishTransaction(purchase)
    // }
    // if (error) {
    //   const deleteError = useDispatch('delete_in_app_pay_error')
    //   deleteError(error)
    // }
  }
  return { iapReady, iapProducts, iapSubscriptions, startInAppPayment, iapProcessing, finishInAppPayment }
}
