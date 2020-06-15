import React from 'react'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import WebPayForm from './web_pay_form'

const stripePromise = null

const WebPayment = (props) => {
  // const { onProgress = () => { } } = props

  const { publishableKey } = props
  if (!stripePromise) {
    if (publishableKey) {
      stripePromise = loadStripe(publishableKey);
    } else {
      throw Error({ message: 'Stripe public key not found. Please contact support.' })
    }
  }

  // async function npStartPurchase (props) {
  //   const { sku, description, amount, isSubscription = false } = props
  //   const { onSuccess = () => { }, onError = () => { } } = props

  //   if (!npReady) {
  //     onProgress({ event: 'np_not_setup', sku, amount, description, isSubscription })
  //     onError({ message: 'Native Pay not initialized. Please contact support.' })
  //   }
    
  //   // Card Entry Fallback
  //   onProgress({ event: 'cc_fallback', sku, description, amount, isSubscription })
  //   const stripePurchase = await tstripe.paymentRequestWithCardForm()
  //   onProgress({ event: 'cc_token', sku, description, amount, isSubscription, meta: { stripePurchase } })
  //   if (stripePurchase?.tokenId) {
  //     onSuccess({ sku, description, amount, isSubscription, stripePurchase, item: props.item })
  //     return stripePurchase
  //   } else {
  //     onError({ message: 'Could not get card token' })
  //   }
  // }

  return (
    <Elements stripe={stripePromise}>
      <WebPayForm />
    </Elements>
  )
  // return { wpReady, wpSetup, wpStartPurchase, wpProcessing: false }
}

export default WebPayment

