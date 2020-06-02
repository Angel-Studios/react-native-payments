import { useEffect } from 'react'
import { useGlobal, setGlobal } from 'reactn'
import AsyncStorage from '@react-native-community/async-storage'
import {
  getProducts,
  getSubscriptions,
  finishTransaction,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  requestSubscription
} from 'react-native-iap'

setGlobal({
  in_app_pay_listeners: [],
  in_app_pay_products: [],
  in_app_pay_subscriptions: [],
  in_app_pay_ready: null,
  in_app_pay_processing: false
})

export default function useInAppPayments (props) {
  const { onProgress = () => { }, onSuccess = () => { } } = props
  const [iapListeners, setIapListeners] = useGlobal('in_app_pay_listeners')
  const [iapProducts, setIapProducts] = useGlobal('in_app_pay_products')
  const [iapSubscriptions, setIapSubscriptions] = useGlobal('in_app_pay_subscriptions')
  const [iapReady, setIapReady] = useGlobal('in_app_pay_ready')
  const [iapProcessing, setIapProcessing] = useGlobal('in_app_pay_processing')

  const iapSetup = async ({ productIds, subscriptionIds }) => {
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
    // It seems getProducts,getSubscriptions must complete before requestPurchase
    // or the user could get charged but we only see an error.
  }
  const iapListen = async () => {
    setIapListeners([
      purchaseUpdatedListener(async (purchase) => {
        // Expect results something like this:
        // {
        //   "purchase": {
        //     "productId": "vidangel_riot_0015",
        //     "transactionId": "1000000673323302",
        //     "transactionDate": 1591039683000,
        //     "transactionReceipt": "..."
        //   }
        // }
        // More detail is available in a query for all previous purchases
        console.log('purchaseUpdatedListener', { purchase })
        onProgress({ event: 'iap_update', meta: { purchase } })
        const receipt = purchase.transactionReceipt
        if (receipt) {
          try {
            const { sku, amount, description, isSubscription } = await getInAppPaymentDataAsync()
            onSuccess({ sku, amount, description, isSubscription, purchase })
            await finishTransaction(purchase)
          } catch (iapError) {
            onProgress({ event: 'iap_error', meta: { iapError: iapError.message } })
          }
        }
      }),
      purchaseErrorListener(async (error) => {
        onProgress({ event: 'iap_error', meta: { error } })
      })
    ])
  }
  // const iapRefresh = async () => {
  //   iapListeners.map(listener => listener.remove())
  //   iapListen()
  // }

  useEffect(() => {
    if (iapListeners.length === 2 && (iapProducts?.length || iapSubscriptions?.length)) {
      console.log('iapReady')
      setIapReady(true)
    }
  }, [iapListeners, iapProducts, iapSubscriptions])

  useEffect(() => {
    // Apple doesn't give an immediate response to purchases, so we need to listen for them.
    // But we don't want multiple listeners at once, or they both get each event.
    if (iapListeners.length === 0) {
      iapListen()
    }
    return () => {
      // This stuff could get run multiple times without problems
      setIapReady(false)
      iapListeners.map(listener => listener.remove())
      setIapListeners([])
    }
  }, [])

  async function iapStartPurchase (props) {
    updateInAppPaymentDataAsync(props)
    const { sku, amount, description, isSubscription = false } = props
    const { onError = () => {} } = props

    if (iapReady) {
      // TODO: Check for sku in in_app_pay_products and in_app_pay_subscriptions
      // onError({ message: 'Apple product sku not set up in initialization. Please contact the developers.' })
      setIapProcessing(true)
      try {
        if (!isSubscription) {
          onProgress({ event: 'iap_requesting_purchase', sku, amount, description, isSubscription })
          requestPurchase(sku, false)
        } else {
          onProgress({ event: 'iap_requesting_subscription', sku, amount, description, isSubscription })
          requestSubscription(sku, false)
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
  return { iapReady, iapSetup, iapProducts, iapSubscriptions, iapStartPurchase, iapProcessing }
}

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
// const clearInAppPaymentDataAsync = async () => {
//   await AsyncStorage.removeItem(IAPSETTINGS)
// }
