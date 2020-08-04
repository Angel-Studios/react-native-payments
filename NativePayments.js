import React, {createContext, useContext} from 'react'
import { Platform } from 'react-native'

const NativePaymentContext = createContext({})

export default function NativePayments(props) {
  console.log('Platform.OS', Platform.OS)
  // if (Platform.OS !== 'ios' && Platform.OS !== 'android') return (
  //   <></>
  // )
  import useNativePay from './use_native_pay'
  const {
    npReady,
    npSetup,
    npStart,
    npProcessing,
    npFinish,
    npReset,
    npFellback // Unable to use Google/Apple Pay, so asking directly for CC
  } = useNativePay(props)

  return (
    <NativePaymentContext.Provider value={{
      npReady,
      npSetup,
      npStart,
      npProcessing,
      npFinish,
      npReset,
      npFellback, // Unable to use Google/Apple Pay, so asking directly for CC
    }}
    >
      {props.children}
    </NativePaymentContext.Provider>
  )
}

export function useNativePayments() {
  return useContext(NativePaymentContext)
}
