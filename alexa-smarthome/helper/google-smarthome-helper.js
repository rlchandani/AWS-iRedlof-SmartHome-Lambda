const axios = require('axios');
const { JWT } = require('google-auth-library');
const serviceAccount = require('../keys/smartHomeAuthKey.json');

const SCOPES = ['smartdevices-272506.apps.googleusercontent.com'];
const GOOGLE_SMARTHOME_API = 'https://us-central1-smartdevices-272506.cloudfunctions.net';
// const GOOGLE_SMARTHOME_API = 'http://host.docker.internal:5001/smartdevices-272506/us-central1';
const API_KEY = 'sDxhe7CIfwfTLfyTRA83cc3PKC62';

exports.discoverDevices = async (requestId) => {
    const token = await authenticate();
    const response = await axios.get(
        `${GOOGLE_SMARTHOME_API}/api/sync`,
        {
            headers: {
                "Authorization": "Bearer " + token.id_token,
            },
            params: {
                apiKey: API_KEY,
                requestId: requestId
            }
        })
        .catch(error => {
            console.error(error);
            return [];
        });
    return convertToAWSDeviceDiscovery(response.data);
}

exports.reportState = async (deviceId, requestId) => {
    const token = await authenticate();
    const response = await axios.get(
        `${GOOGLE_SMARTHOME_API}/api/query`,
        {
            headers: {
                "Authorization": "Bearer " + token.id_token,
            },
            params: {
                apiKey: API_KEY,
                requestId: requestId,
                deviceId: deviceId
            }
        })
        .catch(error => {
            console.error(error);
            return [];
        });
    return convertToAWSReportState(response.data).filter(device => device.endpointId === deviceId);
}

exports.controlDevice = async (deviceId, powerState, requestId) => {
    const token = await authenticate();
    const response = await axios.get(
        `${GOOGLE_SMARTHOME_API}/api/execute`,
        {
            headers: {
                "Authorization": "Bearer " + token.id_token,
            },
            params: {
                apiKey: API_KEY,
                requestId: requestId,
                deviceId: deviceId,
                powerState: powerState
            }
        })
        .catch(error => {
            console.error(error);
            return [];
        });
    return convertToAWSControlDevice(response.data).filter(device => device.endpointId === deviceId);
}

const convertToAWSControlDevice = (response) => {
    const endpoints = [];
    if (response == undefined || response == null) {
        return endpoints;
    }

    response.payload.commands.forEach(devices => {
        devices.ids.forEach(id => {
            const endpoint = {
                endpointId: id,
                property: {
                    namespace: "Alexa.PowerController",
                    name: "powerState",
                    value: "UNKNOWN",
                    timeOfSample: (new Date()).toISOString(),
                    uncertaintyInMilliseconds: Date.now() - new Date()
                }
            };
            endpoints.push(endpoint);
        });
    });
    return endpoints;
}

const convertToAWSReportState = (response) => {
    const endpoints = [];
    if (response == undefined || response == null) {
        return endpoints;
    }

    for (const [deviceId, deviceConfig] of Object.entries(response.payload.devices)) {
        const endpoint = {
            endpointId: deviceId,
            property: {
                namespace: "Alexa.PowerController",
                name: "powerState",
                value: deviceConfig.on ? "ON" : "OFF",
                timeOfSample: (new Date()).toISOString(),
                uncertaintyInMilliseconds: Date.now() - new Date()
            }
        };
        endpoints.push(endpoint);
    }
    return endpoints;
};

const convertToAWSDeviceDiscovery = (response) => {
    const endpoints = [];
    if (response == undefined || response == null) {
        return endpoints;
    }

    response.payload.devices.forEach(device => {
        const endpoint = {
            displayCategories: [
                getDeviceCategory(device.type)
            ],
            capabilities: [
                {
                    interface: "Alexa.PowerController",
                    type: "AlexaInterface",
                    version: 3,
                    properties: {
                        retrievable: true,
                        proactivelyReported: true,
                        supported: [{
                            name: "powerState"
                        }]
                    }
                }
            ],
            cookie: {
                gpio: device.customData.deviceConfig.pin
            },
            endpointId: device.id,
            manufacturerName: device.deviceInfo.manufacturer,
            description: `${device.name.name}, connected via iRedlof SmartHome Skill`,
            version: device.deviceInfo.swVersion,
            friendlyName: device.name.name
        };
        endpoints.push(endpoint);
    });
    return endpoints;
}

const getDeviceCategory = (type) => {
    switch (type) {
        case "action.devices.types.OUTLET":
            return "SMARTPLUG";
        default:
            return "SWITCH";
    }
}

const authenticate = async () => {
    const jwtClient = new JWT({
        email: serviceAccount.client_email,
        key: serviceAccount.private_key,
        scopes: SCOPES
    });
    return await jwtClient.authorize();
}
