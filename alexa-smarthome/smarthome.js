/** Required Libraries */
const axios = require('axios');
const AWS = require("aws-sdk");
const googleSmartHomeHelper = require('./helper/google-smarthome-helper');

/** Lambda Environment Variables */
const PHONE_NUMBER = process.env.phoneNumber; // change it to your phone number
const EMAIL_ADDRESS = process.env.emailAddress; // change it to your email address
const SWITCH_BOARD_DYNAMODB_TABLE = process.env.switchBoardDynamoDBTableName;
const DEVICE_DYNAMODB_TABLE = process.env.deviceDynamoDBTableName;
const IOT_DEVICE_ENDPOINT = process.env.prodIOTDeviceEndpoint;

const iotData = new AWS.IotData({ endpoint: IOT_DEVICE_ENDPOINT });
const iotMQTTChannelCommand = '/iredlof/switchCommand';
const iotMQTTChannelControl = '/iredlof/switchControl';
const iotMQTTChannelFeedback = '/iredlof/switchFeedback';

const docClient = new AWS.DynamoDB.DocumentClient();
const SNS = new AWS.SNS({ apiVersion: '2010-03-31' });

exports.lambdaHandler = async (event, context, callback) => {
    logMessage(false, "Entry", JSON.stringify(event));

    let eventHeader, eventPayload;
    if (event.hasOwnProperty('directive')) {
        eventHeader = event.directive.header;
        eventPayload = event.directive.payload;
    } else {
        logMessage(true, 'Poison Pill', 'This skill is updated to work with V3 payload. Recieved V2 payload');
        context.fail('This skill is updated to work with V3 payload. Recieved V2 payload');
    }

    switch (eventHeader.namespace) {
        case 'Alexa.Discovery':
            await discoverDevices(event, context, callback);
            break;
        case 'Alexa.PowerController':
            await controlDevices(event, context, callback);
            break;
        case 'Alexa.System':
            await systemStatus(event, context, callback);
            break;
        case 'Alexa':
            switch (eventHeader.name) {
                case 'ReportState':
                    await reportState(event, context, callback);
                    break;
                default:
                    logMessage(true, 'Unsupported Name', `No supported name: ${eventHeader.name}`);
                    context.fail('Something went wrong');
            }
            break;
        default:
            logMessage(true, 'Unsupported Namespace', `No supported namespace: ${eventHeader.namespace}`);
            context.fail('Something went wrong');
    }
};

const discoverDevices = async (event, context, callback) => {
    const eventHeader = event.directive.header;
    const eventPayload = event.directive.payload;
    const authenticationType = eventPayload.scope.type;
    const authenticationToken = eventPayload.scope.token;
    const devices = [];

    if (eventHeader.name === 'Discover') {
        var headers = {
            namespace: eventHeader.namespace,
            name: 'Discover.Response',
            payloadVersion: eventHeader.payloadVersion,
            messageId: eventHeader.messageId,
        };
        const userProfileResponse = await getUserProfile(authenticationToken)
            .catch((err) => {
                console.error("Error fetching user profile:", err.response.hasOwnProperty('data') ? err.response.data : err.response);
                context.fail(generateSyncError(eventHeader.messageId, null, 'EXPIRED_AUTHORIZATION_CREDENTIAL', 'Failed to query user profile'));
                return;
            });
        const profile = userProfileResponse.data;
        console.log(`User Profile: ${JSON.stringify(profile)}`);

        const dbResponse = await queryDevice(profile.user_id)
            .catch((err) => {
                console.error(`Failed while querying DynamoDB table: ${err}`);
                context.fail(generateSyncError(eventHeader.messageId, eventHeader.correlationToken, authenticationToken, deviceId, 'INTERNAL_ERROR', `Failed while querying DynamoDB table for deviceId: ${deviceId}`));
                return;
            });
        dbResponse.Items.forEach((item) => {
            devices.push(item.data);
        });

        const googleDevices = await googleSmartHomeHelper.discoverDevices(eventHeader.messageId);
        console.log("Rohit");
        console.log(JSON.stringify(googleDevices));
        googleDevices.forEach(device => {
            devices.push(device);
        });

        var params = {
            topic: iotMQTTChannelCommand,
            payload: `{action:"discoveredAppliances", applianceCount:${devices.length}, user:${profile}}`,
            qos: 0
        };
        await iotData.publish(params).promise()
            .catch((err) => {
                console.error(`Error sending MQTT message: ${err}`);
                context.fail(generateSyncError(eventHeader.messageId, null, 'ENDPOINT_UNREACHABLE', 'Fail to query Dynamodb table'));
                return;
            });

        var discoverResponse = {
            event: {
                header: headers,
                payload: {
                    endpoints: devices
                }
            }
        };
        console.log(`Response: ${JSON.stringify(discoverResponse)}`)
        context.succeed(discoverResponse);
    }
}

const reportState = async (event, context, callback) => {
    const eventHeader = event.directive.header;
    const eventEndpoint = event.directive.endpoint;
    const authenticationType = eventEndpoint.scope.type;
    const authenticationToken = eventEndpoint.scope.token;

    if (eventHeader.name === 'ReportState') {
        var deviceId = eventEndpoint.endpointId;
        var header = {
            namespace: "Alexa",
            name: "StateReport",
            payloadVersion: eventHeader.payloadVersion,
            messageId: eventHeader.messageId,
            correlationToken: eventHeader.correlationToken
        };
        var contextResult = {
            properties: []
        };

        const userProfileResponse = await getUserProfile(authenticationToken)
            .catch((err) => {
                console.error("Error fetching user profile:", err.response.hasOwnProperty('data') ? err.response.data : err.response);
                context.fail(generateAsyncError(eventHeader.messageId, eventHeader.correlationToken, authenticationToken, deviceId, 'EXPIRED_AUTHORIZATION_CREDENTIAL', 'Failed to query user profile'));
                return;
            });
        const profile = userProfileResponse.data;
        console.log(`User Profile: ${JSON.stringify(profile)}`);

        const dbResponse = await queryDevice(profile.user_id, deviceId)
            .catch((err) => {
                console.error(`Failed while querying DynamoDB table for deviceId: ${deviceId} and userId: ${profile.user_id}: ${err}`);
            });
        dbResponse.Items.forEach((item) => {
            var property = {
                namespace: "Alexa.PowerController",
                name: "powerState",
                value: item.power_state,
                timeOfSample: (new Date(item.updated_on)).toISOString(),
                uncertaintyInMilliseconds: Date.now() - new Date(item.updated_on)
            }
            contextResult.properties.push(property);
        });

        if (contextResult.properties.length === 0) {
            const googleResponse = await googleSmartHomeHelper.reportState(deviceId, eventHeader.messageId);
            if (googleResponse.length === 0) {
                context.fail(generateSyncError(eventHeader.messageId, eventHeader.correlationToken, authenticationToken, deviceId, 'INTERNAL_ERROR', `Failed while querying DynamoDB table for deviceId: ${deviceId} and userId: ${profile.user_id}`));
                return;
            }
            googleResponse.forEach(device => {
                contextResult.properties.push(device.property);
            })
        }

        var alexaResponse = {
            context: contextResult,
            event: {
                header: header,
                endpoint: {
                    endpointId: deviceId
                },
                payload: {
                }
            }
        };
        console.log(`Response: ${JSON.stringify(alexaResponse)}`)
        context.succeed(alexaResponse);
    }
}

const controlDevices = async (event, context, callback) => {
    const eventHeader = event.directive.header;
    const eventEndpoint = event.directive.endpoint;
    const authenticationType = eventEndpoint.scope.type;
    const authenticationToken = eventEndpoint.scope.token;

    if (eventHeader.namespace === 'Alexa.PowerController') {
        var command = eventHeader.name;
        var deviceId = eventEndpoint.endpointId;
        var deviceGPIO = eventEndpoint.cookie.gpio;
        var powerState = 0;
        var powerStateValue = "OFF";
        var deviceMQTTIn = eventEndpoint.cookie.in_MQTTChannel;
        var deviceName = "";
        var header = {
            namespace: "Alexa",
            name: "Response",
            payloadVersion: eventHeader.payloadVersion,
            messageId: eventHeader.messageId,
            correlationToken: eventHeader.correlationToken
        };
        var contextResult = {
            properties: [{
                namespace: "Alexa.PowerController",
                name: "powerState",
                value: "UNKNOWN",
                timeOfSample: (new Date()).toISOString(),
                uncertaintyInMilliseconds: 0
            }]
        };

        switch (command) {
            case 'TurnOn':
                powerState = 1;
                powerStateValue = 'ON';
                contextResult.properties[0].value = powerStateValue;
                break;
            case 'TurnOff':
                powerState = 0;
                powerStateValue = 'OFF';
                contextResult.properties[0].value = powerStateValue;
                break;
        }

        const userProfileResponse = await getUserProfile(authenticationToken)
            .catch((err) => {
                /*
                snsParam = {
                    PhoneNumber: PHONE_NUMBER,
                    Message: 'Alexa Control: Failed to connect to MQTT server.',
                };
                SNS.publish(snsParam, function (error, data) {
                    if (error) {
                        console.error("Failed to send SNS message", error.stack);
                        return;
                    }
                    console.log("SNS message sent.");
                });
                */
                console.error("Error fetching user profile:", err.response.hasOwnProperty('data') ? err.response.data : err.response);
                context.fail(generateAsyncError(eventHeader.messageId, eventHeader.correlationToken, authenticationToken, deviceId, 'EXPIRED_AUTHORIZATION_CREDENTIAL', 'Failed to query user profile'));
                return;
            });
        const profile = userProfileResponse.data;
        console.log(`User Profile: ${JSON.stringify(profile)}`);

        const dbResponse = await queryDevice(profile.user_id, deviceId)
            .catch((err) => {
                console.error(`Failed while querying DynamoDB table for deviceId: ${deviceId} and userId: ${profile.user_id}: ${err}`);
                context.fail(generateSyncError(eventHeader.messageId, eventHeader.correlationToken, authenticationToken, deviceId, 'INTERNAL_ERROR', `Failed while querying DynamoDB table for deviceId: ${deviceId} and userId: ${profile.user_id}`));
                return;
            });
        dbResponse.Items.forEach((item) => {
            deviceName = item.data.friendlyName;
            deviceGPIO = item.gpio;
            deviceMQTTIn = item.in_mqtt;
            updateDevicePowerState(profile.user_id, deviceId, powerStateValue)
                .catch((err) => {
                    console.error(`Failed to update power state for deviceId: ${deviceId} and userId: ${profile.user_id}: ${err}`);
                    context.fail(generateSyncError(eventHeader.messageId, eventHeader.correlationToken, authenticationToken, deviceId, 'INTERNAL_ERROR', `Failed to update state for deviceId: ${deviceId} and userId: ${profile.user_id}`));
                    return;
                });
        });

        if (dbResponse.Items.length == 0) {
            const googleResponse = await googleSmartHomeHelper.controlDevice(deviceId, powerStateValue, eventHeader.messageId);
            if (googleResponse.length === 0) {
                console.error(`Could not find device with deviceId: ${deviceId} for userId: ${profile.user_id}`);
                context.fail(generateSyncError(eventHeader.messageId, eventHeader.correlationToken, authenticationToken, deviceId, 'NO_SUCH_ENDPOINT', `Could not find device with deviceId: ${deviceId} for userId: ${profile.user_id}`));
                return;
            }
            googleResponse.forEach(device => {
                device.property.value = powerStateValue;
                contextResult.properties[0].value = device.property.value;
            })
        } else {
            var params = {
                topic: deviceMQTTIn,
                payload: '{gpio: {pin:' + deviceGPIO + ', state:' + powerState + '}}',
                qos: 0
            };
            await iotData.publish(params).promise()
                .catch((err) => {
                    /* 
                    snsParam = {
                        PhoneNumber: PHONE_NUMBER,
                        Message: 'Alexa Control: Failed to publish MQTT to topic ' + appliance_mqtt_in + ". Here is the full event " + JSON.stringify(params),
                    };
                    SNS.publish(snsParam, function (error, data) {
                        if (error) {
                            console.error("Failed to send SNS message", error.stack);
                            return;
                        }
                        console.log("SNS message sent.");
                    });
                    */
                    console.error(`Failed to publish MQTT to IOT device: ${err}`);
                    context.fail(generateSyncError(eventHeader.messageId, eventHeader.correlationToken, authenticationToken, deviceId, 'ENDPOINT_UNREACHABLE', 'Failed to publish MQTT to IOT device'));
                    return;
                });
            /*
            snsParam = {
                PhoneNumber: PHONE_NUMBER,
                Message: 'Alexa Control: ' + appliance_name + " " + (appliance_state ? "turned on" : "turned off") + ".",
            };
            SNS.publish(snsParam, function (error, data) {
                if (error) {
                    console.error("Failed to send SNS message", error.stack);
                    return;
                }
                console.log("SNS message sent.");
            });
            */
        }

        var controlDeviceResponse = {
            context: contextResult,
            event: {
                header: header,
                endpoint: {
                    endpointId: deviceId
                },
                payload: {
                }
            }
        };
        console.log(`Response: ${JSON.stringify(controlDeviceResponse)}`)
        context.succeed(controlDeviceResponse);
    }
};

const systemStatus = async (event, context, callback) => {
    const eventHeader = event.directive.header;
    const eventPayload = event.directive.payload;
    const authenticationType = eventPayload.scope.type;
    const authenticationToken = eventPayload.scope.token;

    var snsParam = {
        PhoneNumber: PHONE_NUMBER,
        Message: 'Alexa Health Status called.',
    };
    var response = {
        "header": {
            "messageId": eventHeader.messageId,
            "name": "HealthCheckResponse",
            "namespace": "Alexa.ConnectedHome.System",
            "payloadVersion": "2"
        },
        "payload": {
            "description": "The system is currently healthy",
            "isHealthy": true
        }
    };
    SNS.publish(snsParam, function (error, data) {
        if (error) {
            logMessage(true, "SNS Status", error.stack);
            return;
        }
        logMessage(false, "SNS Status", "SNS Message Sent.");
        context.succeed(response);
    });
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

function generateSyncError(messageId, endpointId, type, message) {
    var header = {
        namespace: 'Alexa',
        name: 'ErrorResponse',
        messageId,
        payloadVersion: '3'
    };

    var endpoint = { endpointId }

    var payload = { type, message };

    let result;
    if (endpointId) {
        result = {
            event: { header, endpoint, payload }
        };
    } else {
        result = {
            event: { header, payload }
        };
    }
    console.log(result);
    return result;
};

function generateAsyncError(messageId, correlationToken, token, endpointId, type, message) {
    var header = {
        namespace: 'Alexa',
        name: 'ErrorResponse',
        messageId,
        correlationToken,
        payloadVersion: '3'
    };

    var endpoint = {
        scope: {
            type: "BearerToken",
            token
        },
        endpointId
    }

    var payload = { type, message };

    var result = {
        event: { header, endpoint, payload }
    };
    console.log(result);
    return result;
};

/***************************  Extra Code To Create DynamoDB Table and Load Sample Data ***************************/
/** Fetch user profile from Amazon */
const getUserProfile = async (authenticationToken) => {
    var amznProfileURL = `https://api.amazon.com/user/profile?access_token=${authenticationToken}`;
    return await axios.get(amznProfileURL);
};

/** Query device list or single device item from DynamoDB using userId and/or deviceId */
const queryDevice = async (userId, deviceId) => {
    let keyConditionExpression = "#uid = :user_id";
    let expressionAttributeValues = {
        ":user_id": userId
    };
    if (deviceId) {
        keyConditionExpression += " and device_id = :device_id";
        expressionAttributeValues[":device_id"] = deviceId;
    }
    var params = {
        TableName: DEVICE_DYNAMODB_TABLE,
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeNames: {
            "#uid": "user_id"
        },
        ExpressionAttributeValues: expressionAttributeValues
    };
    return await docClient.query(params).promise();
};

/** Update device state in DynamoDB using userId and deviceId */
const updateDevicePowerState = (userId, deviceId, powerState) => {
    var params = {
        TableName: DEVICE_DYNAMODB_TABLE,
        Key: {
            "user_id": userId,
            "device_id": deviceId
        },
        UpdateExpression: "set power_state = :s, updated_on = :t",
        ExpressionAttributeValues: {
            ":s": powerState,
            ":t": Date.now()
        },
        ReturnValues: "UPDATED_NEW"
    };
    return docClient.update(params).promise();
}