const serviceNames = require('../_helpers/serviceNames');
const { isServiceable } = require('./utils')

const deliveryShutdownMessage = `Logistics service has been discontinued from 14th of April.\n\nWe are extremely sorry for the disruption this would bring to your business operations.\n\nWe will refund your wallet recharge balance(For the remaining validity) within the next 180 days.\nWe will continue to focus our time and energy on bringing other products that would greatly benefit you and the industry. We have already launched a Bullion and Coins Marketplace and a product where you can offer No-Interest EMIs to your customers and are working to bring you other products.\n\nWe understand that this would seem sudden and you would've your concerns, but we promise that we tried our hardest, but we couldn't make it a viable business.\n\nWe invested in building the technology, process and people to provide this industry with a logistics network within cities that you could rely on. We delivered 100% of our products safely. We have delivered 10,000+ parcels of 100cr+ of value on bikes.\n\nWe worked hard with all partners of the ecosystem including insurance companies, technology partners, Jewellery association to bring you a service that’s unmatched in customer experience and safety.\nHowever, we couldn’t make it a viable business because of the frequency of usage of the service and the value limitations placed by our insurance partners.\n\nWe were incurring fixed costs on a monthly basis, even on days and months of limited to no utilisation. We tried various pricing models, operational models, but we were unable to make it a viable business.\n\nWe acknowledge that we could have done a few things differently and we have invested a lot of money, time and efforts to try and make secure logistics on bikes a reality, but we couldn’t make it work.\n\nWe apologise again for the inconvenience this might have caused to you, we will work harder to bring you other products that can greatly benefit you and the ecosystem.\n\nWe're available to answer all your questions, please feel free to get in touch with us.\nThank you for being a part of the Gordian family and for supporting us always. 🙏🙏\n\nWe request your continued love and support with our new offerings to the Jewellery industry.`

function checkServiceability(serviceName) {
    return [
        async (req, res, next) => {
            let newServiceName = serviceName
            if (req.params.serviceName != undefined) {
                newServiceName = req.params.serviceName
            }

            const isServiceUp = await isServiceable(newServiceName)

            if (isServiceUp) {
                next();
            } else {
                if (newServiceName === serviceNames.delivery) {
                    return res.status(503).json({
                        enabled: false,
                        message: deliveryShutdownMessage
                    })
                }
                return res.status(503).json({
                    enabled: false,
                    message: "We are not accepting " + newServiceName + " orders at the moment"
                })
            }
        }
    ];
}

module.exports = checkServiceability;
