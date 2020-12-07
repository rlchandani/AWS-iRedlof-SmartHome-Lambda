'use strict';

const { USER_DEVICES_DYNAMODB_TABLE, docClient } = require('../helper/dbHelper');

exports.get = async (userId, deviceId) => {
    let keyConditionExpression = "#uid = :user_id";
    let expressionAttributeValues = {
        ":user_id": userId
    };
    if (deviceId) {
        keyConditionExpression += " and device_id = :device_id";
        expressionAttributeValues[":device_id"] = deviceId;
    }
    const params = {
        TableName: USER_DEVICES_DYNAMODB_TABLE,
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeNames: {
            "#uid": "user_id"
        },
        ExpressionAttributeValues: expressionAttributeValues
    };
    console.log("Attempting to get user devices");
    let userDevicesSnapshot;
    try {
        userDevicesSnapshot = await docClient.query(params).promise();
    } catch (err) {
        console.error('Failed to query database in function: get.', err);
        throw err;
    }
    return userDevicesSnapshot;
}

exports.add = async (userId, deviceId) => {
    const params = {
        TableName: USER_DEVICES_DYNAMODB_TABLE,
        Item: {
            user_id: userId,
            device_id: deviceId,
            updated_on: Date.now()
        }
    };
    console.log("Attempting to add a new device to user");
    let userDevicesSnapshot;
    try {
        userDevicesSnapshot = await docClient.put(params).promise();
    } catch (err) {
        console.error('Failed to query database in function: add.', err);
        throw err;
    }
    return userDevicesSnapshot;
};

exports.delete = async (userId) => {
    const params = {
        TableName: USER_DEVICES_DYNAMODB_TABLE,
        Key: {
            user_id: userId
        }
    };
    console.log("Attempting to delete a user");
    let userDevicesSnapshot;
    try {
        userDevicesSnapshot = await docClient.delete(params).promise();
    } catch (err) {
        console.error('Failed to query database in function: delete.', err);
        throw err;
    }
    return userDevicesSnapshot;
};