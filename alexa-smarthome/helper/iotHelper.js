'use strict';

/** Required Libraries */
const AWS = require('aws-sdk');

exports.IOT_DEVICE_ENDPOINT = process.env.prodIOTDeviceEndpoint;
exports.iotData = new AWS.IotData({ endpoint: this.IOT_DEVICE_ENDPOINT });
exports.iotMQTTChannelCommand = '/iredlof/switchCommand';
exports.iotMQTTChannelControl = '/iredlof/switchControl';
exports.iotMQTTChannelFeedback = '/iredlof/switchFeedback';
