/** Required Libraries */
const AWS = require("aws-sdk");
const { SUCCESS, ERROR } = require('./model/status');
const orchestration = require('./orchestration');

/** Lambda Environment Variables */
const PHONE_NUMBER = process.env.phoneNumber; // change it to your phone number

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
        case 'Alexa.Authorization':
            await userAuthorization(event, context, callback);
            break;
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

const userAuthorization = async (event, context, callback) => {
    const response = await orchestration.appOnAuthorization(event);
    console.log(`Response: ${JSON.stringify(response.message)}`);
    if (response.status === ERROR) {
        context.fail(response.message);
    }
    context.succeed(response.message);
};

const discoverDevices = async (event, context, callback) => {
    const response = await orchestration.appOnSync(event);
    console.log(`Response: ${JSON.stringify(response.message)}`);
    if (response.status === ERROR) {
        context.fail(response.message);
    }
    context.succeed(response.message);
}

const reportState = async (event, context, callback) => {
    const response = await orchestration.appOnQuery(event);
    console.log(`Response: ${JSON.stringify(response.message)}`);
    if (response.status === ERROR) {
        context.fail(response.message);
    }
    context.succeed(response.message);
}

const controlDevices = async (event, context, callback) => {
    const response = await orchestration.appOnExecute(event);
    console.log(`Response: ${JSON.stringify(response.message)}`);
    if (response.status === ERROR) {
        context.fail(response.message);
    }
    context.succeed(response.message);
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
