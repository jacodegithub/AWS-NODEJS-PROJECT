const request = require('request');

module.exports = {
    getTravelDistance,
    getLatLongFromAddress
};

/**
 * @param {*} orgLat Origin Latitude
 * @param {*} orgLng Origin Longitude
 * @param {*} destLat Destination Latitude
 * @param {*} destLng Destinattion Longitude
 * 
 * Google Maps TravelDistance Response
 * {
 *      destination_addresses: Array<string>
 *      origin_addresses:      Array<string>
 *      rows:                   [{
 *          elements: [{
 *              distance: {
 *                  label
 *                  text
 *              },
 *              duration: {
 *                  label
 *                  text
 *              }
 *          }]
 *      }]
 *      status <string>
 * }
 * @returns { distance, duration }
 */
function getTravelDistance(orgLat, orgLng, destLat, destLng) {
    return new Promise((resolve, reject) => {
        let requestURL = `https://maps.googleapis.com/maps/api/distancematrix/json`;
        requestURL += `?units=metric`;
        requestURL += `&origins=${orgLat},${orgLng}`;
        requestURL += `&destinations=${destLat},${destLng}`;
        requestURL += `&key=${process.env.GOOGLE_APIKEY}`;

        request(requestURL, function(error, response, distanceMatrixResponse) {
            if (error) return reject(error);

            distanceMatrixResponse = JSON.parse(distanceMatrixResponse);
            // console.info("GoogleMapsService::getTravelDistance:: Distance matrix response is ", response, "Body is ", distanceMatrixResponse);
            
            const { rows } = distanceMatrixResponse;
            const [ elementsList ] = rows;
            const { elements } = elementsList;
            const [ elementsObject ] = elements;

            if (elementsObject.status === "ZERO_RESULTS") {
                console.error("GoogleMapsService::GetTravelDistance:: No results found", elementsObject);
                return reject({
                    "status": 404,
                    "message": "Cannot traverse from origin to destination",
                    "errors": []
                });
            };

            const { distance, duration } = elementsObject;
            resolve({ distance, duration });
        });
    });
};

function getLatLongFromAddress(address) {
    return new Promise((resolve, reject) => {
        let requestURL = `https://maps.googleapis.com/maps/api/geocode/json`;
        requestURL += `?address=${address}`;
        requestURL += `&key=${process.env.GOOGLE_APIKEY}`;

        request(requestURL, function(error, response, body) {
            if (error) return reject(error);

            body = JSON.parse(body);
            
            if (!body.results || body.results.length === 0) {
                console.error("GoogleMapsService::GetLatLongFromAddress:: No results found", body);
                return reject({
                    "status": 404,
                    "message": "Address not found on google",
                    "errors": []
                });
            };

            const { lat, lng } = body.results[0].geometry.location;
            resolve({ lat, lng });
        });
    });
  }