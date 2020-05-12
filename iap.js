import { useGlobal, setGlobal } from 'reactn'
import RNIap, { purchaseErrorListener, purchaseUpdatedListener } from 'react-native-iap'

setGlobal({
  iap_listeners: [],
  iap_products: [],
  iap_subscriptions: [],
  iap_ready: false
})

const afterPayment = ({ purchase }) => {
  RNIap.finishTransaction(purchase)
}

const startPayment = async ({ sku, isSubscription = false }) => {
  const [iapReady] = useGlobal('iap_ready')
  if (iapReady) {
    try {
      if (!isSubscription) {
        await RNIap.requestPurchase(sku, false)
        // The 'false' above means you should call afterPayment once the purchase is successfully recorded in our backend database
        // Otherwise purchaseUpdatedListener and/or purchaseErrorListener will retrigger for those purchases each time the app restarts.
      } else {
        await RNIap.requestSubscription(sku, false)
      }
    } catch (error) {
      onError(error)
    }  
  } else {
    // I'm not sure what the format should be for errors, please adjust if you have something better
    onError({ code: 'gtxj26', message: 'In-app payments are not ready yet. Please try again in a few minutes, then restart your app, if it still is not working.' })
  }
}

const InitializeInAppPayments = (props) => {
  const onReady = (props.onReady) ? props.onReady : () => {}
  const onProgress = (props.onProgress) ? props.onProgress : () => {} // Use this to log progress for debugging purposes
  const onPayment = (props.onPayment) ? props.onPayment : () => {} // Make this idempotent or call afterPayment when order is recorded
  const onError = (props.onError) ? props.onError : () => {}
  const devMode = (props.devMode) ? props.devMode : __DEV__

  const [iapListeners, setIapListeners] = useGlobal('iap_listeners')
  // It might be useful to use the following globals in the UI
  const [, setIapProducts] = useGlobal('iap_products')
  const [, setIapSubscriptions] = useGlobal('iap_subscriptions')
  const [, setIapReady] = useGlobal('iap_ready')
  useEffect(() => {
    setIapReady(false)
    setIapListeners([
      purchaseUpdatedListener((purchase) => {
        onProgress({ event: 'purchaseUpdated', purchase })
        onPayment(purchase)
      }),
      purchaseErrorListener((error) => {
        onProgress({ event: 'purchaseError', error })
        onError(error)
      })
    ])
    preLoad()
    return () => {
      iapListeners.map(listener => listener.remove())
      setIapListeners([])
    }
  }, [])

  const preLoad = async () => {
    const { productIds, subscriptionIds } = props
    const productSkus = (devMode) ? ['android.test.purchased'] : productIds
    const subscriptionSkus = (devMode) ? [] : subscriptionIds
    let products = []
    if (productSkus.length > 0) {
      const startTime = Date.now()
      products = await RNIap.getProducts(productSkus)
      onProgress({ event: 'gotProducts', products, elapsed: (Date.now() - startTime) })
    } 
    setIapProducts(products)
    let subscriptions = []
    if (subscriptionSkus.length > 0) {
      const startTime = Date.now()
      subscriptions = await RNIap.getSubscriptions(subscriptionSkus)
      onProgress({ event: 'gotSubscriptions', subscriptions, elapsed: (Date.now() - startTime) })
    } 
    setIapSubscriptions(subscriptions)
    // RNIap.getProducts,getSubscriptions must complete before RNIap.requestPurchase or the user could get charged but we only see an error.
    setIapReady(true)
    onReady({ products, subscriptions })
  }
}
