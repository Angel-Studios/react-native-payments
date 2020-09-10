import React, {createContext, useContext, useState, useEffect} from 'react'
import useNativePay from './use_native_pay'
import useInAppPay from './use_in_app_pay'

const PaymentContext = createContext({})

export default function Payments(props) {
  const onProgress = props.onProgress ? props.onProgress : () => {
  }
  const stripe = props.stripe ? props.stripe : () => {
  }

  const {
    npReady,
    npSetup,
    npStart,
    npProcessing,
    npFinish,
    npReset,
    npFellback // Unable to use Google/Apple Pay, so asking directly for CC
  } = useNativePay(props)

  const {
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
  } = useInAppPay(props)

  /////////////////////////////////////////////////////
  // Generic purchasing (in-app or native purchases) //
  /////////////////////////////////////////////////////
  const [paymentReady, setPaymentReady] = useState(false)
  const [paymentProcessing, setPaymentProcessing] = useState(false)

  useEffect(() => {
    console.log({npReady, iapReady})
    setPaymentReady(npReady || iapReady)
  }, [npReady, iapReady])

  useEffect(() => {
    console.log({npProcessing, iapProcessing})
    setPaymentProcessing(npProcessing || iapProcessing)
  }, [npProcessing, iapProcessing])

  const paymentSetup = async (props) => {
    const {inApp, native} = props
    if (inApp) iapSetup(inApp)
    if (native) npSetup(native)
  }

  const paymentStart = async (props) => {
    const {productId, description, amount, isSubscription = false} = props
    onProgress({event: 'payment_start', productId, amount, description, isSubscription})
    if (npReady) {
      return await npStart(props)
    } else if (iapReady) {
      return await iapStart(props)
    } else {
      onProgress({event: 'payment_not_ready', productId, amount, description, isSubscription})
    }
  }

  const paymentFinish = (purchase) => {
    if (iapProcessing) {
      iapFinish(purchase)
      iapReset()
    } else if (npProcessing) npReset()
  }

  const paymentReset = () => {
    if (iapProcessing) iapReset()
    else if (npProcessing) npReset()
  }

  return (
    <Elements stripe={stripe}>
      <PaymentContext.Provider value={{
        paymentReady,
        paymentSetup,
        paymentStart,
        paymentProcessing,
        paymentFinish,
        paymentReset,

        npReady,
        npSetup,
        npStart,
        npProcessing,
        npFinish,
        npReset,
        npFellback, // Unable to use Google/Apple Pay, so asking directly for CC

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
      }}
      >
        {props.children}
      </PaymentContext.Provider>
    </Elements>
  )
}

export function usePayments() {
  return useContext(PaymentContext)
}
