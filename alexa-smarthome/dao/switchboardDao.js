'use strict';

const { SWITCH_BOARD_DYNAMODB_TABLE, docClient } = require('../helper/dbHelper');

exports.get = async (switchboardId) => {
    const params = {
        TableName: SWITCH_BOARD_DYNAMODB_TABLE,
        Key: {
            switchboard_id: switchboardId
        }
    };
    console.log("Attempting to get a switchboard");
    let switchboardSnapshot;
    try {
        switchboardSnapshot = await docClient.get(params).promise();
    } catch (err) {
        console.error('Failed to query database in function: get.', err);
        throw err;
    }
    return switchboardSnapshot;
}

exports.add = async (switchboardId, name, serial) => {
    const params = {
        TableName: SWITCH_BOARD_DYNAMODB_TABLE,
        Item: {
            switchboard_id: switchboardId,
            name: name,
            serial: serial,
            updated_on: Date.now()
        }
    };
    console.log("Attempting to add a new switchboard");
    let switchboardSnapshot;
    try {
        switchboardSnapshot = await docClient.put(params).promise();
    } catch (err) {
        console.error('Failed to query database in function: add.', err);
        throw err;
    }
    return switchboardSnapshot;
};

exports.update = async (switchboardId, name, serial) => {
    const params = {
        TableName: SWITCH_BOARD_DYNAMODB_TABLE,
        Key: {
            switchboard_id: switchboardId
        },
        UpdateExpression: 'SET name = :a, serial = :b, updated_on = :t',
        ExpressionAttributeValues: {
            ':a': name,
            ':b': serial,
            ':t': Date.now()
        },
        ReturnValues: 'UPDATED_NEW'
    };
    console.log("Attempting to update an existing switchboard");
    let switchboardSnapshot;
    try {
        switchboardSnapshot = await docClient.update(params).promise();
    } catch (err) {
        console.error('Failed to query database in function: update.', err);
        throw err;
    }
    return switchboardSnapshot;
};

exports.delete = async (switchboardId) => {
    const params = {
        TableName: SWITCH_BOARD_DYNAMODB_TABLE,
        Key: {
            switchboard_id: switchboardId
        }
    };
    console.log("Attempting to delete a switchboard");
    let switchboardSnapshot;
    try {
        switchboardSnapshot = await docClient.delete(params).promise();
    } catch (err) {
        console.error('Failed to query database in function: delete.', err);
        throw err;
    }
    return switchboardSnapshot;
};
