'use strict';

/** Required Libraries */
const AWS = require('aws-sdk');

exports.AWS_REGION = process.env.region;
exports.SWITCH_BOARD_DYNAMODB_TABLE = process.env.switchBoardDynamoDBTableName;
exports.DEVICES_DYNAMODB_TABLE = process.env.devicesDynamoDBTableName;
exports.DEVICES_CONFIG_DYNAMODB_TABLE = process.env.devicesConfigDynamoDBTableName;
exports.USERS_DYNAMODB_TABLE = process.env.usersDynamoDBTableName;
exports.USER_DEVICES_DYNAMODB_TABLE = process.env.userDevicesDynamoDBTableName;

// Set the region
AWS.config.update({ region: this.AWS_REGION });

// Create the DynamoDB service object
exports.docClient = new AWS.DynamoDB.DocumentClient();
