import React, {createContext, useContext, useState, useEffect} from 'react'
import useInAppPay from './use_in_app_pay'

const InAppPaymentContext = createContext({})

export default function InAppPayments(props) {
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

  return (
    <InAppPaymentContext.Provider value={{
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
    </InAppPaymentContext.Provider>
  )
}

export function useInAppPayments() {
  return useContext(InAppPaymentContext)
}
