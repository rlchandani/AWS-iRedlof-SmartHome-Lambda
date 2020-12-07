const AWS = require("aws-sdk");

const ENVIRONMENT = process.env.environment;
const SWITCH_BOARD_DYNAMODB_TABLE = process.env.switchBoardDynamoDBTableName;
const DEVICE_DYNAMODB_TABLE = process.env.devicesDynamoDBTableName;
const USER_ID = "amzn1.account.AGHZGP6K7X74P4QVRIJEW7BUVB5Q"

exports.add = async (event, context, callback) => {
    switchBoardData.forEach(async (item) => {
        await addItemInSwitchBoardTable(item)
            .catch((err) => {
                console.error("Unable to add item. Error JSON:", JSON.stringify(err));
            });
    });
    deviceData.forEach(async (item) => {
        await addItemInDeviceTable(item)
            .catch((err) => {
                console.error("Unable to add item. Error JSON:", JSON.stringify(err));
            });
    });

    context.succeed("Success");
};

exports.query = async (event, context, callback) => {
    const switchBoardDBResponse = await queryDynamoDB(SWITCH_BOARD_DYNAMODB_TABLE, USER_ID)
        .catch((err) => {
            console.error(`Error querying DynamoDB table: ${err}`);
            context.fail('Fail to query Dynamodb table');
            return;
        });

    console.log(`Respone: ${SWITCH_BOARD_DYNAMODB_TABLE}`);
    switchBoardDBResponse.Items.forEach(item => {
        console.log(JSON.stringify(item));
    });

    const deviceDBResponse = await queryDynamoDB(DEVICE_DYNAMODB_TABLE, USER_ID)
        .catch((err) => {
            console.error(`Error querying DynamoDB table: ${err}`);
            context.fail('Fail to query Dynamodb table');
            return;
        });

    console.log(`Respone: ${DEVICE_DYNAMODB_TABLE}`);
    deviceDBResponse.Items.forEach(item => {
        console.log(JSON.stringify(item));
    });

    context.succeed("Success");
};

const switchBoardData = [
    {
        "board_id": "0080000987",
        "board_name": "Living Room - TV Set",
        "board_serial_no": "0080000987",
        "user_id": USER_ID
    }
];

const deviceData = [
    {
        "data": {
            "capabilities": [
                {
                    "interface": "Alexa.PowerController",
                    "properties": {
                        "proactivelyReported": true,
                        "retrievable": true,
                        "supported": [
                            {
                                "name": "powerState"
                            }
                        ]
                    },
                    "type": "AlexaInterface",
                    "version": "3"
                }
            ],
            "cookie": {
                "gpio": 14,
                "in_MQTTChannel": "/0080000987/command",
                "out_MQTTChannel": "/0080000987/feedback"
            },
            "description": "Left Lamp, connected via iRedlof SmartHome Skill",
            "displayCategories": [
                "LIGHT"
            ],
            "endpointId": "0080000987_leftLamp",
            "friendlyName": "Left Lamp",
            "manufacturerName": "Ikea",
            "version": "v0.1"
        },
        "device_id": "0080000987_leftLamp",
        "gpio": 14,
        "in_mqtt": "/0080000987/command",
        "out_mqtt": "/0080000987/feedback",
        "state": "OFF",
        "updated_on": 1604225698336,
        "user_id": USER_ID
    },
    {
        "data": {
            "capabilities": [
                {
                    "interface": "Alexa.PowerController",
                    "properties": {
                        "proactivelyReported": true,
                        "retrievable": true,
                        "supported": [
                            {
                                "name": "powerState"
                            }
                        ]
                    },
                    "type": "AlexaInterface",
                    "version": "3"
                }
            ],
            "cookie": {
                "gpio": 13,
                "in_MQTTChannel": "/0080000987/command",
                "out_MQTTChannel": "/0080000987/feedback"
            },
            "description": "Right Lamp, connected via iRedlof SmartHome Skill",
            "displayCategories": [
                "LIGHT"
            ],
            "endpointId": "0080000987_rightLamp",
            "friendlyName": "Right Lamp",
            "manufacturerName": "Ikea",
            "version": "v0.1"
        },
        "device_id": "0080000987_rightLamp",
        "gpio": 13,
        "in_mqtt": "/0080000987/command",
        "out_mqtt": "/0080000987/feedback",
        "state": "OFF",
        "updated_on": 1604225692215,
        "user_id": USER_ID
    },
    {
        "data": {
            "capabilities": [
                {
                    "interface": "Alexa.PowerController",
                    "properties": {
                        "proactivelyReported": true,
                        "retrievable": true,
                        "supported": [
                            {
                                "name": "powerState"
                            }
                        ]
                    },
                    "type": "AlexaInterface",
                    "version": "3"
                }
            ],
            "cookie": {
                "gpio": 12,
                "in_MQTTChannel": "/0080000987/command",
                "out_MQTTChannel": "/0080000987/feedback"
            },
            "description": "Television, connected via iRedlof SmartHome Skill",
            "displayCategories": [
                "SWITCH"
            ],
            "endpointId": "0080000987_tv",
            "friendlyName": "TV",
            "manufacturerName": "Toshiba",
            "version": "v0.1"
        },
        "device_id": "0080000987_tv",
        "gpio": 12,
        "in_mqtt": "/0080000987/command",
        "out_mqtt": "/0080000987/feedback",
        "state": "OFF",
        "updated_on": 1604257497454,
        "user_id": USER_ID
    },
    {
        "data": {
            "capabilities": [
                {
                    "interface": "Alexa.PowerController",
                    "properties": {
                        "proactivelyReported": true,
                        "retrievable": true,
                        "supported": [
                            {
                                "name": "powerState"
                            }
                        ]
                    },
                    "type": "AlexaInterface",
                    "version": "3"
                }
            ],
            "cookie": {
                "gpio": 16,
                "in_MQTTChannel": "/0080000987/command",
                "out_MQTTChannel": "/0080000987/feedback"
            },
            "description": "Window Lamp, connected via iRedlof SmartHome Skill",
            "displayCategories": [
                "LIGHT"
            ],
            "endpointId": "0080000987_windowLamp",
            "friendlyName": "Window Lamp",
            "manufacturerName": "Ikea",
            "version": "v0.1"
        },
        "device_id": "0080000987_windowLamp",
        "gpio": 16,
        "in_mqtt": "/0080000987/command",
        "out_mqtt": "/0080000987/feedback",
        "state": "OFF",
        "updated_on": 1604203732366,
        "user_id": USER_ID
    }
];

const getDDBConnection = () => {
    if (ENVIRONMENT == 'local') {
        return new AWS.DynamoDB.DocumentClient({ endpoint: "http://dynamodb:8000/" });
    }
    return new AWS.DynamoDB.DocumentClient();
}

const addItemInSwitchBoardTable = async (data) => {
    var params = {
        TableName: SWITCH_BOARD_DYNAMODB_TABLE,
        Item: {
            "board_id": data.board_id,
            "board_name": data.board_name,
            "board_serial_no": data.board_serial_no,
            "user_id": data.user_id
        }
    };
    const docClient = getDDBConnection();
    await docClient.put(params).promise();
};

const addItemInDeviceTable = async (data) => {
    var params = {
        TableName: DEVICE_DYNAMODB_TABLE,
        Item: {
            "user_id": data.user_id,
            "device_id": data.device_id,
            "gpio": data.gpio,
            "in_mqtt": data.in_mqtt,
            "out_mqtt": data.out_mqtt,
            "state": data.state,
            "updated_on": data.updated_on,
            "data": data.data
        }
    };
    const docClient = getDDBConnection();
    await docClient.put(params).promise();
};

const queryDynamoDB = async (tablename, userId) => {
    let keyConditionExpression = "#uid = :user_id";
    let expressionAttributeValues = {
        ":user_id": userId
    };
    var params = {
        TableName: tablename,
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeNames: {
            "#uid": "user_id"
        },
        ExpressionAttributeValues: expressionAttributeValues
    };
    const docClient = getDDBConnection();
    return await docClient.query(params).promise();
};