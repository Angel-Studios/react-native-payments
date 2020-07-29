import React, { useEffect, useState } from 'react'
import { Platform } from 'react-native'
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


export default function useInAppPay (props) {
  const onProgress = props.onProgress ? props.onProgress : () => {
  }
  ////////////////////////////////////////////////
  // In-app purchasing (can be Apple or Google) //
  ////////////////////////////////////////////////
  const [iapReady, setIapReady] = useState(false)
  const [iapProcessing, setIapProcessing] = useState(false)
  const [iapProducts, setIapProducts] = useState([])
  const [iapSubscriptions, setIapSubscriptions] = useState([])
  const [iapPurchase, setIapPurchase] = useState(null)
  const [iapError, setIapError] = useState(null)
  let iapCancelPurchase = () => {
  }

  useEffect(() => {
    if (Platform.OS !== 'ios') return
    const simpleListeners = [
      purchaseUpdatedListener(async (purchase) => {
        onProgress({event: 'iap_listener_update', meta: {purchase}})
        finishTransaction(purchase).then()
        setIapPurchase(purchase)
        iapCancelPurchase = () => {
        }
      }),
      purchaseErrorListener(async (error) => {
        onProgress({event: 'iap_listener_error', meta: {error}})
        setIapError(error)
        iapCancelPurchase()
        iapCancelPurchase = () => {
        }
        setIapProcessing(false)
      })
    ]
    return () => {
      // if (simpleListeners) simpleListeners.map(listener => listener.remove())
    }
  }, [])

  async function iapSetup(props) {
    const {productIds, subscriptionIds} = props
    console.log({productIds, subscriptionIds})
    onProgress({event: 'iap_setup', meta: {productIds, subscriptionIds}})
    if (Platform.OS === 'ios') {
      await initConnection()
      let noItems = true
      if (productIds) {
        const startTime = Date.now()
        const products = await getProducts(productIds)
        if (products.length > 0) noItems = false
        onProgress({event: 'iap_setup_products', meta: {products, elapsed: (Date.now() - startTime), productIds}})
        setIapProducts(products)
      }
      if (subscriptionIds) {
        const startTime = Date.now()
        const subscriptions = await getSubscriptions(subscriptionIds)
        if (subscriptions.length > 0) noItems = false
        onProgress({
          event: 'iap_setup_subscriptions',
          meta: {subscriptions, elapsed: (Date.now() - startTime), subscriptionIds}
        })
        setIapSubscriptions(subscriptions)
      }
      // It seems getProducts,getSubscriptions must complete before requestPurchase
      // or the user could get charged but we only see an error.
      if (!noItems) {
        onProgress({event: 'iap_ready'})
        setIapReady(true)
      }
    }
  }

  function runWithCancel(fn, ...args) {
    const gen = fn(...args);
    let cancelled, cancel;
    const promise = new Promise((resolve, promiseReject) => {
      // define cancel function to return it from our fn
      cancel = () => {
        console.log('runWithCancel cancel')
        cancelled = true;
        reject({reason: 'cancelled'});
      };

      let value;
      onFulfilled();

      function onFulfilled(res) {
        console.log('runWithCancel onFulfilled', res)
        if (!cancelled) {
          let result;
          try {
            result = gen.next(res);
          } catch (e) {
            return reject(e);
          }
          next(result);
          return null;
        }
      }

      function onRejected(err) {
        console.log('runWithCancel onRejected', err)
        let result;
        try {
          result = gen.throw(err);
        } catch (e) {
          return reject(e);
        }
        next(result);
      }

      function next({done, value}) {
        console.log('runWithCancel next', done, value)
        if (done) {
          return resolve(value);
        }
        // we assume we always receive promises, so no type checks
        return value.then(onFulfilled, onRejected);
      }
    });

    return {promise, cancel};
  }

  async function iapStart(props) {
    const {productId, amount, description, isSubscription = false} = props

    if (!iapReady) {
      onProgress({event: 'iap_early_purchase', productId, amount, description, isSubscription})
      throw 'In-app payments have not been initialized. Please contact support.'
    }
    if (iapProcessing) {
      onProgress({event: 'iap_already_processing', productId, amount, description, isSubscription})
      throw 'In-app payment already in progress. Please contact support if this happens again tomorrow after restarting the app.'
    }
    // TODO: Check for productId in in_app_pay_products and in_app_pay_subscriptions
    // throw 'Apple productId not set up in initialization. Please contact the developers.'

    setIapProcessing(true)
    if (!isSubscription) {
      onProgress({event: 'iap_requesting_purchase', productId, amount, description, isSubscription})
      const {purchasePromise, purchaseCancel} = runWithCancel(requestPurchase, productId, false)
      iapCancelPurchase = purchaseCancel
      const purchase = await purchasePromise
      console.log({purchase})
      if (purchase) {
        onProgress({event: 'iap_requested_purchase', productId, amount, description, isSubscription, meta: {purchase}})
      } else {
        onProgress({event: 'iap_purchase_cancelled', productId, amount, description, isSubscription, meta: {}})
        throw 'Cancelled or failed'
      }
      return purchase
    } else {
      onProgress({event: 'iap_requesting_subscription', productId, amount, description, isSubscription})
      const {subscriptionPromise, purchaseCancel} = runWithCancel(requestSubscription, productId, false)
      iapCancelPurchase = purchaseCancel
      const subscription = await subscriptionPromise
      if (subscription) {
        onProgress({
          event: 'iap_requested_subscription',
          productId,
          amount,
          description,
          isSubscription,
          meta: {subscription}
        })
      } else {
        onProgress({event: 'iap_subscription_cancelled', productId, amount, description, isSubscription, meta: {}})
        throw 'Cancelled or failed'
      }
      return subscription
    }
    // The 'false' above means you should call iapFinish(purchase) once the purchase is successfully recorded in our backend database
  }

  async function iapFinish(purchase) {
    await finishTransaction(purchase)
    setIapProcessing(false)
  }

  async function iapReset() {
    setIapProcessing(false)
  }

  return {
    iapReady,
    iapSetup,
    iapStart,
    iapProcessing,
    iapFinish,
    iapReset,
    iapProducts, // pricing in local currency available here
    iapSubscriptions, // pricing in local currency available here
    iapPurchase, // The last purchase can be used in case the payment timed out initially
    iapError // The last error for displaying to the user
  }
}
