# Overview
In app payments are performed asynchronously.
You should initialize them with InitializeInAppPayments immediately when the app starts,
so everything is ready when the user wants to make a payment
(worst case scenario the initialization has taken more than a week, so start it as soon as possible)

There is a check in place to prevent payments (using onError) until things are ready,
otherwise the user gets charged, but we don't know about it.

# Apple
Product ID is a unique alphanumeric ID that is used for reporting. After you use a Product ID for one product, it can’t be used again, even if the product is deleted. They can only contain alphanumeric characters, underscores, and periods, but the Reference Name can contain more 

Apple limits in-app purchases and subscriptions to no more than $999.99, and users can in-app purchase only up to 10 of a single product at a time

You can't do in-app purchases in the Simulator. You must use a real device. You can set up a separate Apple ID account for doing in-app purchases in the Sandbox.

# Android
Product ID starts with number or lowercase letter and can contain only numbers (0-9), lowercase letters (a-z), underscores (_) & periods (.).
You can’t modify a product ID after the item is created, and you can’t reuse a product ID within an app. 

Google limits in-app purchases to no more than $400.
