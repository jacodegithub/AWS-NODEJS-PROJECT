**Service**
* Handles the authentication for users
* Deals with payments using Razorpay
* Deals with pickup and drop logistics using Locus

On a very high level:
+ Users can register and sign in
+ They can place an order and attempt to make a payment for it.
+ (IMPORTANT) Webhooks exposed by Locus and Razorpay handle the lifeycle of order creation and transport.
    + When payment succeeds, the razorpay webhook creates a locus task
    + Locus task notifies webhook on various events


**Deployment**
Run the Node service using Docker.

You can expose the node service 
( on local ) using Ngrok
( on servers ) by using Nginx to proxy requests to service

**Dependencies**
* MongoDB
* Razorpay
* Firebase 
* Gupshup ( SMS )
* Locus