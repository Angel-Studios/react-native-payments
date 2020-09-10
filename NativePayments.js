import React, {createContext, useContext} from 'react'
import { Platform } from 'react-native'
import useNativePay from './use_native_pay' // This is going to be a problem if Apple makes us rip native payments out of our code again. The reason this is not a problem is because we started doing physical good purchases so Apple is okay with the native payment module.

const NativePaymentContext = createContext({})

export default function NativePayments(props) {
  console.log('Platform.OS', Platform.OS)
  // if (Platform.OS !== 'ios' && Platform.OS !== 'android') return (
  //   <></>
  // )
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
