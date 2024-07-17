const Enums = require('./Enums');

module.exports = {
    "categories": {
        "customer": [{
            "label": "Documents & Files",
            "id": "docs",
            "is_insured": false
        }, {
            "label": "Phones & Other Electronics",
            "id": "electronics",
            "is_insured": false
        }, {
            "label": "Gifting Items",
            "id": "gifts",
            "is_insured": false
        }, {
            "label": "Food & Meals",
            "id": "food",
            "is_insured": false
        }, {
            "label": "Any other item",
            "id": Enums.Products.Categories.misc,
            "is_insured": false
        }],
        "bussiness": [{
            "label": "Documents & Files",
            "id": "docs",
            "is_insured": false
        }, {
            "label": "Phones & Other Electronics",
            "id": "electronics",
            "is_insured": false
        }, {
            "label": "Jewellery",
            "id": "jewellery",
            "is_insured": true
        },
        {
            "label": "Gifting Items",
            "id": "gifts",
            "is_insured": false
        }, {
            "label": "Food & Meals",
            "id": "food",
            "is_insured": false
        }, {
            "label": "Any other item",
            "id": Enums.Products.Categories.misc,
            "is_insured": false
        }]
    }
}