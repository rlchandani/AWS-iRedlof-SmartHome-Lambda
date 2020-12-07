'use strict';

const { DEVICES_DYNAMODB_TABLE, docClient } = require('../helper/dbHelper');

exports.get = async (deviceId) => {
    const params = {
        TableName: DEVICES_DYNAMODB_TABLE,
        Key: {
            device_id: deviceId
        }
    };
    console.log("Attempting to get a device");
    let deviceSnapshot;
    try {
        deviceSnapshot = await docClient.get(params).promise();
    } catch (err) {
        console.error('Failed to query database in function: get.', err);
        throw err;
    }
    return deviceSnapshot;
};

exports.getAll = async () => {
    const params = {
        TableName: DEVICES_DYNAMODB_TABLE
    }
    console.log("Attempting to get all devices");
    let devicesSnapshot;
    try {
        devicesSnapshot = await docClient.scan(params).promise();
    } catch (err) {
        console.error('Failed to query database in function: getAll.', err);
        throw err;
    }
    return devicesSnapshot;
};

exports.add = async (deviceId, gpio, inMQTT, outMQTT, powerState) => {
    const params = {
        TableName: DEVICES_DYNAMODB_TABLE,
        Item: {
            device_id: deviceId,
            gpio: gpio,
            in_mqtt: inMQTT,
            out_mqtt: outMQTT,
            power_state: powerState,
            updated_on: Date.now()
        }
    };
    console.log("Attempting to add a new device");
    let deviceSnapshot;
    try {
        deviceSnapshot = await docClient.put(params).promise();
    } catch (err) {
        console.error('Failed to query database in function: add.', err);
        throw err;
    }
    return deviceSnapshot;
};

exports.update = async (deviceId, gpio, inMQTT, outMQTT, powerState) => {
    const params = {
        TableName: DEVICES_DYNAMODB_TABLE,
        Key: {
            device_id: deviceId
        },
        UpdateExpression: 'SET gpio = :a, in_mqtt = :b, out_mqtt = :c, power_state = :d, updated_on = :t',
        ExpressionAttributeValues: {
            ':a': gpio,
            ':b': inMQTT,
            ':c': outMQTT,
            ':d': powerState,
            ':t': Date.now()
        },
        ReturnValues: 'UPDATED_NEW'
    };
    console.log("Attempting to update an existing device");
    let deviceSnapshot;
    try {
        deviceSnapshot = await docClient.update(params).promise();
    } catch (err) {
        console.error('Failed to query database in function: update.', err);
        throw err;
    }
    return deviceSnapshot;
};

exports.updatePowerState = async (deviceId, powerState) => {
    const params = {
        TableName: DEVICES_DYNAMODB_TABLE,
        Key: {
            device_id: deviceId
        },
        UpdateExpression: 'SET power_state = :a, updated_on = :t',
        ExpressionAttributeValues: {
            ':a': powerState,
            ':t': Date.now()
        },
        ReturnValues: 'UPDATED_NEW'
    };
    console.log("Attempting to update an existing device power_state");
    let deviceSnapshot;
    try {
        deviceSnapshot = await docClient.update(params).promise();
    } catch (err) {
        console.error('Failed to query database in function: updatePowerState.', err);
        throw err;
    }
    return deviceSnapshot;
};

exports.delete = async (deviceId) => {
    const params = {
        TableName: DEVICES_DYNAMODB_TABLE,
        Key: {
            device_id: deviceId
        }
    };
    console.log("Attempting to delete a device");
    let deviceSnapshot;
    try {
        deviceSnapshot = await docClient.delete(params).promise();
    } catch (err) {
        console.error('Failed to query database in function: delete.', err);
        throw err;
    }
    return deviceSnapshot;
};
