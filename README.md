# Overview
In app payments are performed asynchronously.
You should initialize them with InitializeInAppPayments immediately when the app starts,
so everything is ready when the user wants to make a payment
(worst case scenario the initialization has taken more than a week, so start it as soon as possible)

There is a check in place to prevent payments (using onError) until things are ready,
otherwise the user gets charged, but we don't know about it.

# Apple
Limits in app purchases and subscriptions to $999.99

People can purchase up to 10 of a single product at a time

# Android
Limits in app purchases to $400