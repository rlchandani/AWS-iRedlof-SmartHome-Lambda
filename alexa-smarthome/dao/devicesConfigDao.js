'use strict';

const { DEVICES_CONFIG_DYNAMODB_TABLE, docClient } = require('../helper/dbHelper');

exports.get = async (deviceId) => {
    const params = {
        TableName: DEVICES_CONFIG_DYNAMODB_TABLE,
        Key: {
            device_id: deviceId
        }
    };
    console.log("Attempting to get a device config");
    let deviceConfigSnapshot;
    try {
        deviceConfigSnapshot = await docClient.get(params).promise();
    } catch (err) {
        console.error('Failed to query database in function: get.', err);
        throw err;
    }
    return deviceConfigSnapshot;
}

exports.getAll = async () => {
    const params = {
        TableName: DEVICES_CONFIG_DYNAMODB_TABLE
    };
    console.log("Attempting to get all device config");
    let deviceConfigSnapshot;
    try {
        deviceConfigSnapshot = await docClient.scan(params).promise();
    } catch (err) {
        console.error('Failed to query database in function: getAll.', err);
        throw err;
    }
    return deviceConfigSnapshot;
}

exports.getBatch = async (deviceIds) => {
    const paramsDeviceIds = [];
    deviceIds.forEach(deviceId => {
        paramsDeviceIds.push({device_id: deviceId});
    });
    const params = {
        RequestItems: {
            [DEVICES_CONFIG_DYNAMODB_TABLE]: {
                Keys: paramsDeviceIds
            }
        }
    };
    console.log("Attempting to get multiple device config");
    let deviceConfigSnapshot;
    try {
        deviceConfigSnapshot = await docClient.batchGet(params).promise();
    } catch (err) {
        console.error('Failed to query database in function: getBatch.', err);
        throw err;
    }
    return deviceConfigSnapshot;
};

exports.add = async (deviceId, switchboardId, config) => {
    const params = {
        TableName: DEVICES_CONFIG_DYNAMODB_TABLE,
        Item: {
            device_id: deviceId,
            switchboard_id: switchboardId,
            config: config,
            updated_on: Date.now()
        }
    };
    console.log("Attempting to add a new device config");
    let deviceConfigSnapshot;
    try {
        deviceConfigSnapshot = await docClient.put(params).promise();
    } catch (err) {
        console.error('Failed to query database in function: add.', err);
        throw err;
    }
    return deviceConfigSnapshot;
};

exports.update = async (deviceId, switchoardId, config) => {
    const params = {
        TableName: DEVICES_CONFIG_DYNAMODB_TABLE,
        Key: {
            device_id: deviceId
        },
        UpdateExpression: 'SET switchboard_id = :a, config = :b, updated_on = :t',
        ExpressionAttributeValues: {
            ':a': switchoardId,
            ':b': config,
            ':t': Date.now()
        },
        ReturnValues: 'UPDATED_NEW'
    };
    console.log("Attempting to update an existing device config");
    let deviceConfigSnapshot;
    try {
        deviceConfigSnapshot = await docClient.update(params).promise();
    } catch (err) {
        console.error('Failed to query database in function: update.', err);
        throw err;
    }
    return deviceConfigSnapshot;
};

exports.delete = async (deviceId) => {
    const params = {
        TableName: DEVICES_CONFIG_DYNAMODB_TABLE,
        Key: {
            device_id: deviceId
        }
    };
    console.log("Attempting to delete a device config");
    let deviceConfigSnapshot;
    try {
        deviceConfigSnapshot = await docClient.delete(params).promise();
    } catch (err) {
        console.error('Failed to query database in function: delete.', err);
        throw err;
    }
    return deviceConfigSnapshot;
};
