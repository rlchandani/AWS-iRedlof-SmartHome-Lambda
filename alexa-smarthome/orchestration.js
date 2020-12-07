'use strict';

const axios = require('axios');
const { SUCCESS, ERROR } = require('./model/status');
const userDao = require('./dao/userDao');
const switchboardDao = require('./dao/switchboardDao');
const devicesConfidDao = require('./dao/devicesConfigDao');
const devicesDao = require('./dao/devicesDao');
const userDevicesDao = require('./dao/userDevicesDao');
const googleSmartHomeHelper = require('./helper/google-smarthome-helper');
const { DEVICES_CONFIG_DYNAMODB_TABLE } = require('./helper/dbHelper');
const { iotData } = require('./helper/iotHelper');

const importDevices = async () => {
    const addSwitchBoardsPromise = [];
    const switchboardsRaw = require('./data/switchboards.json');
    const switchboards = JSON.parse(JSON.stringify(switchboardsRaw));

    const addDeviceConfigPromise = [];
    const addDevicePromise = [];
    const devicesRaw = require('./data/devices.json');
    const devices = JSON.parse(JSON.stringify(devicesRaw));

    console.log('Importing switchboards');
    switchboards.forEach(switchboard => {
        const switchboardId = switchboard.id;
        const name = switchboard.name;
        const serial = switchboard.serial;
        addSwitchBoardsPromise.push(switchboardDao.add(switchboardId, name, serial));
    });
    await Promise.all(addSwitchBoardsPromise);

    console.log('Importing device configs and devices');
    devices.forEach(device => {
        const deviceId = device.device_id;
        const switchboardId = device.switchboard_id;
        const config = device.config;
        const gpio = config.cookie.gpio;
        const inMQTT = config.cookie.in_MQTTChannel;
        const outMQTT = config.cookie.out_MQTTChannel;
        const powerState = 'OFF';
        addDeviceConfigPromise.push(devicesConfidDao.add(deviceId, switchboardId, config));
        addDevicePromise.push(devicesDao.add(deviceId, gpio, inMQTT, outMQTT, powerState));
    });
    await Promise.all(addDeviceConfigPromise);
    await Promise.all(addDevicePromise);
};

const registerAllDevicesToUser = async (userId) => {
    await importDevices();
    console.log(`Registering all devices to userId: ${userId}`);
    const registerUserDevicePromise = [];
    const devicesSnapshot = await devicesDao.getAll();
    if (devicesSnapshot !== null && devicesSnapshot.Count > 0) {
        devicesSnapshot.Items.forEach(device => {
            const deviceId = device.device_id;
            registerUserDevicePromise.push(userDevicesDao.add(userId, deviceId));
        });
        await Promise.all(registerUserDevicePromise);
    }
};

const registerUserManual = async (data) => {
    try {
        await this.getUser(data.userId);
        console.log(`User with userId: ${data.userId} found, updating profile info`);
        await userDao.update(
            data.userId,
            data.name,
            data.email,
            data.grant,
            data.grantee
        );
    } catch (err) {
        console.log(`User with userId: ${data.userId} not found, creating profile`);
        await userDao.add(
            data.userId,
            data.name,
            data.email,
            data.grant,
            data.grantee
        );
    }
    await registerAllDevicesToUser(data.userId);
    console.log('Added/Updated user with id:', data.userId, 'and email:', data.email);
};

exports.getUser = async (userId) => {
    try {
        const userSnapshot = await userDao.get(userId);
        if (userSnapshot !== null && userSnapshot.Count > 0 && userSnapshot.Item.homegraphEnabled === true) {
            console.log(`Returning user profile with id: ${userId}.`);
            return userSnapshot.Item;
        }
        throw new Error(`No active user found with id: ${userId}`);
    } catch (err) {
        console.error(`Failed to get user with id: ${userId}.`, err);
        throw err;
    }
};

exports.deleteUser = async (userId) => {
    try {
        await userDao.delete(userId);
        console.log(`Deleted user with id: ${userId}.`);
    } catch (err) {
        console.error(`Failed to delete user with id: ${userId}.`, err);
        throw err;
    }
};

exports.appOnAuthorization = async (event) => {
    const eventHeader = event.directive.header;
    const eventPayload = event.directive.payload;
    const grant = eventPayload.grant;
    const grantee = eventPayload.grantee;
    const authenticationType = grantee.type;
    const authenticationToken = grantee.token;
    const response = {
        status: ERROR,
        message: {}
    }

    if (eventHeader.name === 'AcceptGrant') {
        var responseHeaderName = 'AcceptGrant.Response';
        var payload = {}
        const userProfile = await getUserProfile(authenticationToken)
            .catch(() => {
                response.message = generateSyncError(eventHeader.messageId, null, 'EXPIRED_AUTHORIZATION_CREDENTIAL', 'Failed to query user profile');
                return response;
            });

        await registerUserManual({
            userId: userProfile.user_id,
            name: userProfile.name,
            email: userProfile.email,
            grant: grant,
            grantee: grantee
        }).catch(err => {
            console.error("Error registering user: ", err);
            responseHeaderName = 'ErrorResponse';
            payload = {
                type: 'ACCEPT_GRANT_FAILED',
                message: 'Failed to handle the AcceptGrant directive because error occured while saving user info'
            }
        });

        var authorizeResponse = {
            event: {
                header: {
                    namespace: eventHeader.namespace,
                    name: responseHeaderName,
                    payloadVersion: eventHeader.payloadVersion,
                    messageId: eventHeader.messageId,
                },
                payload: payload
            }
        };
        response.status = SUCCESS;
        response.message = authorizeResponse;
    }
    return response;
};

exports.appOnSync = async (event) => {
    const eventHeader = event.directive.header;
    const eventPayload = event.directive.payload;
    const authenticationType = eventPayload.scope.type;
    const authenticationToken = eventPayload.scope.token;
    const response = {
        status: ERROR,
        message: {}
    }

    if (eventHeader.name === 'Discover') {
        var headers = {
            namespace: eventHeader.namespace,
            name: 'Discover.Response',
            payloadVersion: eventHeader.payloadVersion,
            messageId: eventHeader.messageId,
        };
        var payload = {
            endpoints: []
        }
        const userProfile = await getUserProfile(authenticationToken)
            .catch(() => {
                response.message = generateSyncError(eventHeader.messageId, null, 'EXPIRED_AUTHORIZATION_CREDENTIAL', 'Failed to query user profile');
                return response;
            });

        // Checking if deviceConfig table have data else importing and registering all devices to current user
        const devicesConfigSnapshot = await devicesConfidDao.getAll();
        if (devicesConfigSnapshot !== null && devicesConfigSnapshot.Count === 0) {
            console.info('No device config was found, importing...');
            await registerAllDevicesToUser(userProfile.user_id);
        }

        // Fetching all devices from AWS IoT SmartHome service
        const deviceIds = [];
        const userDevicesSnapshot = await userDevicesDao.get(userProfile.user_id);
        if (userDevicesSnapshot !== null && userDevicesSnapshot.Count > 0) {
            userDevicesSnapshot.Items.forEach(userDevice => deviceIds.push(userDevice.device_id));
            const devicesConfigSnapshot = await devicesConfidDao.getBatch(deviceIds);
            if (devicesConfigSnapshot !== null && devicesConfigSnapshot.Responses[DEVICES_CONFIG_DYNAMODB_TABLE].length > 0) {
                devicesConfigSnapshot.Responses[DEVICES_CONFIG_DYNAMODB_TABLE].forEach(device => {
                    payload.endpoints.push(device.config);
                });
            } else {
                console.warn("No device config found!");
            }
        }

        // Fetching all devices from Google IoT SmartHome service
        const googleDevices = await googleSmartHomeHelper.discoverDevices(eventHeader.messageId);
        payload.endpoints.push(...googleDevices);

        var discoverResponse = {
            event: {
                header: headers,
                payload: payload
            }
        };
        response.status = SUCCESS;
        response.message = discoverResponse;
    }
    return response;
};

exports.appOnQuery = async (event) => {
    const eventHeader = event.directive.header;
    const eventEndpoint = event.directive.endpoint;
    const authenticationType = eventEndpoint.scope.type;
    const authenticationToken = eventEndpoint.scope.token;
    const response = {
        status: ERROR,
        message: {}
    }

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

        const userProfile = await getUserProfile(authenticationToken)
            .catch(() => {
                response.message = generateAsyncError(eventHeader.messageId, eventHeader.correlationToken, authenticationToken, deviceId, 'EXPIRED_AUTHORIZATION_CREDENTIAL', 'Failed to query user profile');
                return response;
            });
        const userDevicesSnapshot = await userDevicesDao.get(userProfile.user_id, deviceId);
        if (userDevicesSnapshot !== null && userDevicesSnapshot.Count > 0) {
            const deviceSnapshot = await devicesDao.get(deviceId);
            if (deviceSnapshot !== null && deviceSnapshot.Item !== null) {
                const device = deviceSnapshot.Item;
                var property = {
                    namespace: "Alexa.PowerController",
                    name: "powerState",
                    value: device.power_state,
                    timeOfSample: (new Date(device.updated_on)).toISOString(),
                    uncertaintyInMilliseconds: Date.now() - new Date(device.updated_on)
                }
                contextResult.properties.push(property);
            } else {
                console.error(`Could not find device with deviceId: ${deviceId} in DynamoDB table`);
                response.message = generateAsyncError(eventHeader.messageId, eventHeader.correlationToken, authenticationToken, deviceId, 'INTERNAL_ERROR', `Could not find device with deviceId: ${deviceId} in DynamoDB table`);
                return response;
            }
        }

        // Trigger Google IoT API if the device is not found in AWS IoT
        if (contextResult.properties.length === 0) {
            const googleResponse = await googleSmartHomeHelper.reportState(deviceId, eventHeader.messageId);
            if (googleResponse.length === 0) {
                console.error(`Could not find device with deviceId in Google SmartHome service: ${deviceId}`);
                response.message = generateAsyncError(eventHeader.messageId, eventHeader.correlationToken, authenticationToken, deviceId, 'INTERNAL_ERROR', `Could not find device with deviceId in Google SmartHome service: ${deviceId}`);
                return response;
            }
            googleResponse.forEach(device => {
                contextResult.properties.push(device.property);
            });
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
        response.status = SUCCESS;
        response.message = alexaResponse;
    }
    return response;
};

exports.appOnExecute = async (event) => {
    const eventHeader = event.directive.header;
    const eventEndpoint = event.directive.endpoint;
    const authenticationType = eventEndpoint.scope.type;
    const authenticationToken = eventEndpoint.scope.token;
    const response = {
        status: ERROR,
        message: {}
    }

    if (eventHeader.namespace === 'Alexa.PowerController') {
        var command = eventHeader.name;
        var deviceId = eventEndpoint.endpointId;
        var powerState = 0;
        var powerStateValue = "OFF";
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

        const userProfile = await getUserProfile(authenticationToken)
            .catch(() => {
                response.message = generateAsyncError(eventHeader.messageId, eventHeader.correlationToken, authenticationToken, deviceId, 'EXPIRED_AUTHORIZATION_CREDENTIAL', 'Failed to query user profile');
                return response;
            });
        const userDevicesSnapshot = await userDevicesDao.get(userProfile.user_id, deviceId);
        if (userDevicesSnapshot !== null && userDevicesSnapshot.Count > 0) {
            const deviceSnapshot = await devicesDao.get(deviceId);
            if (deviceSnapshot !== null && deviceSnapshot.Item !== null) {
                const device = deviceSnapshot.Item;
                await devicesDao.updatePowerState(deviceId, powerStateValue);
                var params = {
                    topic: device.in_mqtt,
                    payload: '{gpio: {pin:' + device.gpio + ', state:' + powerState + '}}',
                    qos: 0
                };
                await iotData.publish(params).promise()
                    .catch((err) => {
                        console.error(`Failed to publish MQTT to IOT device: ${err}`);
                        response.message = generateAsyncError(eventHeader.messageId, eventHeader.correlationToken, authenticationToken, deviceId, 'ENDPOINT_UNREACHABLE', 'Failed to publish MQTT to IOT device');
                        return response;
                    });
            } else {
                console.error(`Could not find device with deviceId: ${deviceId} in DynamoDB table`);
                response.message = generateAsyncError(eventHeader.messageId, eventHeader.correlationToken, authenticationToken, deviceId, 'INTERNAL_ERROR', `Could not find device with deviceId: ${deviceId} in DynamoDB table`);
                return response;
            }
        } else {
            // Trigger Google IoT API if the device is not found in AWS IoT
            const googleResponse = await googleSmartHomeHelper.controlDevice(deviceId, powerStateValue, eventHeader.messageId);
            if (googleResponse.length === 0) {
                console.error(`Could not find device with deviceId: ${deviceId} for userId: ${userProfile.user_id} in Google SmartHome service`);
                response.message = generateAsyncError(eventHeader.messageId, eventHeader.correlationToken, authenticationToken, deviceId, 'NO_SUCH_ENDPOINT', `Could not find device with deviceId: ${deviceId} for userId: ${userProfile.user_id} in Google SmartHome service`);
                return response;
            }
            googleResponse.forEach(device => {
                device.property.value = powerStateValue;
                contextResult.properties[0].value = device.property.value;
            })
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
        response.status = SUCCESS;
        response.message = controlDeviceResponse;
    }
    return response;
};

/** Fetch user profile from Amazon */
const getUserProfile = async (authenticationToken) => {
    var amznProfileURL = `https://api.amazon.com/user/profile?access_token=${authenticationToken}`;
    const userProfileResponse = await axios.get(amznProfileURL)
        .catch((err) => {
            console.error("Error fetching user profile:", err.response.hasOwnProperty('data') ? err.response.data : err.response);
            throw err;
        });
    console.log(`User Profile: ${JSON.stringify(userProfileResponse.data)}`);
    return userProfileResponse.data;
};

const generateSyncError = (messageId, endpointId, type, message) => {
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
    // console.log(result);
    return result;
};

const generateAsyncError = (messageId, correlationToken, token, endpointId, type, message) => {
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
    // console.log(result);
    return result;
};

/*
var params = {
    topic: iotMQTTChannelCommand,
    payload: `{action:"discoveredAppliances", applianceCount:${payload.endpoints.length}, user:${userProfile.user_id}`,
    qos: 0
};
await iotData.publish(params).promise()
    .catch((err) => {
        console.error("Error sending MQTT message", err);
        response.message = generateSyncError(eventHeader.messageId, null, 'ENDPOINT_UNREACHABLE', 'Error sending MQTT message');
        return response;
    });
*/

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