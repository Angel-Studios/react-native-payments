import {
  useEffect
} from 'react-native'
import { useGlobal, setGlobal, addReducer, useDispatch } from 'reactn'
import RNIap, { purchaseErrorListener, purchaseUpdatedListener } from 'react-native-iap'

setGlobal({
  in_app_pay_listeners: [],
  in_app_pay_callbacks: {},
  in_app_pay_products: [],
  in_app_pay_subscriptions: [],
  in_app_pay_updates: [],
  in_app_pay_errors: [],
  in_app_pay_devmode: false,
  in_app_pay_ready: null
})

export async function getUpdates () {
  const [iapUpdates] = useGlobal('in_app_pay_updates')
  return iapUpdates
}
export async function getErrors () {
  const [iapErrors] = useGlobal('in_app_pay_errors')
  return iapErrors
}
export async function afterComplete ({ purchase, error }) {
  if (purchase) {
    const deleteUpdate = useDispatch('delete_in_app_pay_update')
    deleteUpdate(purchase)
    RNIap.finishTransaction(purchase)
  }
  if (error) {
    const deleteError = useDispatch('delete_in_app_pay_error')
    deleteError(error)
  }
}

export async function startInAppPayment (props) {
  const { sku, amount, description, isSubscription = false } = props
  const { onProgress = () => {}, onSuccess = () => {}, onError = () => {}  } = props
  const saveCallbacks = useDispatch('save_in_app_pay_callbacks')
  saveCallbacks(sku, { onProgress, onSuccess, onError, sku, amount, description, isSubscription })

  const [iapReady] = useGlobal('in_app_pay_ready')
  if (iapReady) {
    // TODO: Check for sku in in_app_pay_products and in_app_pay_subscriptions
    // onError({ message: 'Apple product sku not set up in initialization. Please contact the developers.' })
    try {
      if (!isSubscription) {
        onProgress({ event: 'in_app_pay_requesting_purchase', sku, amount, description, isSubscription })
        await RNIap.requestPurchase(sku, false)
      } else {
        onProgress({ event: 'in_app_pay_requesting_subscription', sku, amount, description, isSubscription })
        await RNIap.requestSubscription(sku, false)
      }
      // The 'false' above means you should call afterComplete once the purchase is successfully recorded in our backend database
      // Otherwise purchaseUpdatedListener and/or purchaseErrorListener will retrigger for those purchases each time the app restarts.
    } catch (error) {
      onError(error)
    }
  } else if (iapReady === null) {
    onError({ message: 'In-app payments have not been initialized. Please contact the support.' })
  } else {
    // I'm not sure what the format should be for errors, please adjust if you have something better
    onError({ message: 'In-app payments are not ready yet. Please try again in a minute or two, then if it still is not working, restart your app.' })
  }
}

export default function InitializeInAppPay (props) {
  // const { productIds, subscriptionIds } = props // These are consumed in preLoad(props)
  // eslint-disable-next-line no-undef
  const { devMode = !!__DEV__ } = props
  const { onProgress = () => {} } = props
  const [, setDevMode] = useGlobal('in_app_pay_devmode')
  setDevMode(devMode)

  const [iapListeners, setIapListeners] = useGlobal('in_app_pay_listeners')

  // It might be useful to use the following global in the UI
  const [, setIapReady] = useGlobal('in_app_pay_ready')

  useEffect(() => {
    // Save the error so we can put it somewhere the user can see it and report on it.
    addReducer('save_in_app_pay_error', (global, dispatch, error) => ({
      in_app_pay_errors: [...global.in_app_pay_errors, error]
    }))
    addReducer('delete_in_app_pay_error', (global, dispatch, error) => ({
      in_app_pay_errors: [...global.in_app_pay_errors.filter(item => item !== error)]
    }))

    // Save the update in case we want to try again if our backend server was down/broken.
    addReducer('save_in_app_pay_update', (global, dispatch, purchase) => ({
      in_app_pay_updates: [ ...global.in_app_pay_updates, purchase]
    }))
    addReducer('delete_in_app_pay_update', (global, dispatch, purchase) => ({
      in_app_pay_updates: [...global.in_app_pay_updates.filter(item => item !== purchase)]
    }))

    // Make it so we can catch individual purchases and route them to the proper callback
    addReducer('save_in_app_pay_callbacks', (global, dispatch, sku, callbacks) => ({
      in_app_pay_callbacks: { ...global.in_app_pay_callbacks, [sku]: callbacks}
    }))
    addReducer('delete_in_app_pay_callbacks', (global, dispatch, sku) => {
      const { [sku]: _, ...newCallBacks } = global.in_app_pay_callbacks
      return { in_app_pay_callbacks: newCallBacks }
    })

    // Apple doesn't give an immediate response to purchases, so we need to listen for them.
    iapListeners.map(listener => listener.remove())
    setIapListeners([
      purchaseUpdatedListener((purchase) => {
        const saveUpdate = useDispatch('save_in_app_pay_update')
        saveUpdate(purchase)
        console.log('purchase', purchase)
        const { sku } = purchase
        const [iapCallbacks] = useGlobal('in_app_pay_callbacks')
        if (sku in iapCallbacks) {
          const { onProgress, onSuccess, sku, amount, description, isSubscription } = iapCallbacks[sku]
          onProgress({ event: 'in_app_pay_update', sku, amount, description, isSubscription, meta: { purchase } })
          onSuccess(purchase)
          const deleteCallbacks = useDispatch('delete_in_app_pay_callbacks')
          deleteCallbacks(sku)
        } else {
          onProgress({ event: 'in_app_pay_update', meta: { purchase } })
        }
        // The purchase will come through the listener each time it is started
        // until RNIap.finishTransaction is called (see afterComplete)
      }),
      purchaseErrorListener((error) => {
        const saveError = useDispatch('save_in_app_pay_error')
        saveError(error)
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

    // We have to get more details from Apple for all skus that we might use,
    // or we might charge them and return an error instead of fulfilling their order
    preLoad(props)

    return () => {
      setIapReady(false)
      iapListeners.map(listener => listener.remove())
      setIapListeners([])
    }
  }, [])
}

const preLoad = async (props) => {
  const { productIds, subscriptionIds } = props
  // eslint-disable-next-line no-undef
  const { devMode = !!__DEV__ } = props
  const { onProgress = () => {} } = props
  const productSkus = (devMode) ? ['android.test.purchased'] : productIds
  const subscriptionSkus = (devMode) ? [] : subscriptionIds

  // It might be useful to use the following globals in the UI
  const [, setIapReady] = useGlobal('in_app_pay_ready')
  const [, setIapProducts] = useGlobal('in_app_pay_products')
  const [, setIapSubscriptions] = useGlobal('in_app_pay_subscriptions')

  let products = []
  if (productSkus.length > 0) {
    const startTime = Date.now()
    products = await RNIap.getProducts(productSkus)
    onProgress({ event: 'in_app_pay_got_products', meta: { products, elapsed: (Date.now() - startTime), productSkus } })
  }
  setIapProducts(products)
  let subscriptions = []
  if (subscriptionSkus.length > 0) {
    const startTime = Date.now()
    subscriptions = await RNIap.getSubscriptions(subscriptionSkus)
    onProgress({ event: 'in_app_pay_got_subscriptions', meta: { subscriptions, elapsed: (Date.now() - startTime), subscriptionSkus } })
  }
  setIapSubscriptions(subscriptions)
  // RNIap.getProducts,getSubscriptions must complete before RNIap.requestPurchase or the user could get charged but we only see an error.
  setIapReady(true)
}
