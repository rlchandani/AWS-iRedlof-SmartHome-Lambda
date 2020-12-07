/** Required Libraries */
const axios = require('axios');
const AWS = require("aws-sdk");

exports.lambdaHandler = async (event, context, callback) => {
    logMessage(false, "Entry", JSON.stringify(event));
    var responseBody = {
        "key3": "value3",
        "key2": "value2",
        "key1": "value1"
    };

    var response = {
        "statusCode": 200,
        "headers": {
            "my_header": "my_value"
        },
        "body": JSON.stringify(responseBody),
        "isBase64Encoded": false
    };
    callback(null, response);
};

function logMessage(isError, title, msg) {
    if (isError) {
        console.error('*************** Start: ' + title + ' *************');
        console.error(msg);
        console.error('*************** End: ' + title + ' *************');
    } else {
        console.log('*************** Start: ' + title + ' *************');
        console.log(msg);
        console.log('*************** End: ' + title + ' *************');
    }
};