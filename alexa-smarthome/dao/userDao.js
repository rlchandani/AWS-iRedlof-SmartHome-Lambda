'use strict';

const { USERS_DYNAMODB_TABLE, docClient } = require('../helper/dbHelper');

exports.get = async (userId) => {
    const params = {
        TableName: USERS_DYNAMODB_TABLE,
        Key: {
            user_id: userId
        }
    };
    console.log("Attempting to get a user");
    let userSnapshot;
    try {
        userSnapshot = await docClient.get(params).promise();
    } catch (err) {
        console.error('Failed to query database in function: get.', err);
        throw err;
    }
    return userSnapshot;
}

exports.add = async (userId, name, email, grant, grantee) => {
    const params = {
        TableName: USERS_DYNAMODB_TABLE,
        Item: {
            user_id: userId,
            name: name,
            email: email,
            grant: grant,
            grantee: grantee,
            homegraphEnabled: true,
            updated_on: Date.now()
        }
    };
    console.log("Attempting to add a new user");
    let userSnapshot;
    try {
        userSnapshot = await docClient.put(params).promise();
    } catch (err) {
        console.error('Failed to query database in function: add.', err);
        throw err;
    }
    return userSnapshot;
};

exports.update = async (userId, name, email, grant, grantee) => {
    const params = {
        TableName: USERS_DYNAMODB_TABLE,
        Key: {
            user_id: userId
        },
        UpdateExpression: 'SET #name = :a, email = :b, #grant = :c, grantee = :d, homegraphEnabled = :e, updated_on = :t',
        ExpressionAttributeNames: {
            '#name': 'name',
            '#grant': 'grant'
        },
        ExpressionAttributeValues: {
            ':a': name,
            ':b': email,
            ':c': grant,
            ':d': grantee,
            ':e': true,
            ':t': Date.now()
        },
        ReturnValues: 'UPDATED_NEW'
    };
    console.log("Attempting to update an existing user");
    let userSnapshot;
    try {
        userSnapshot = await docClient.update(params).promise();
    } catch (err) {
        console.error('Failed to query database in function: update.', err);
        throw err;
    }
    return userSnapshot;
};

exports.delete = async (userId) => {
    const params = {
        TableName: USERS_DYNAMODB_TABLE,
        Key: {
            user_id: userId
        }
    };
    console.log("Attempting to delete a user");
    let userSnapshot;
    try {
        userSnapshot = await docClient.delete(params).promise();
    } catch (err) {
        console.error('Failed to query database in function: delete.', err);
        throw err;
    }
    return userSnapshot;
};