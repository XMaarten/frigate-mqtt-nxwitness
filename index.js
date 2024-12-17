const https = require("https");
const mqtt = require('mqtt');
const axios = require('axios');

// Load configuration
var config = require('/config/config.json');

// Setup MQTT connection
console.log('Trying to connect to MQTT...');
var client  = mqtt.connect('mqtt://'+ config.mqtt.host, {
  port: 1883,
  username: config.mqtt.username,
  password: config.mqtt.password
});

client.on('connect', function () {
  client.subscribe(config.mqtt.topic +'/events/#', function (err) {
    console.log('Subscribed to MQTT topic: '+ config.mqtt.topic);
  });
});

// On receive MQTT message
client.on('message', function (topic, message) {
  try {
    var eventData = JSON.parse(message);

    // Only hanle 'end' event
    if(eventData.type == 'end' && !eventData.after.false_positive) {

      var camera = eventData.after.camera;
      var mappedCamera = config.cameraMap.find(i => i.frigateName == camera);

      if(mappedCamera !== undefined) {

        // Gather event data
        var event = {
           name: eventData.after.label,
           startTimeMs: Math.round(eventData.after.start_time * 1000),
           durationMs: Math.round((eventData.after.end_time - eventData.after.start_time) * 1000),
           tag: 'frigate'
        };

        // Send data to NX Witness
        axios.request({
          httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            method: 'post',
            url: 'https://'+ config.nxwitness.host +':'+ config.nxwitness.port +'/rest/v3/devices/' + mappedCamera.nxwId + '/bookmarks',
            auth: {
              username: config.nxwitness.username,
              password: config.nxwitness.password
            },
            responseType: 'json',
            params: {
              '_local' : true
            },
            data: Object.assign({ format: 'json' }, event)
          })
          .then(function (response) {
            console.log('Notified NX Witness of "'+ event.name +'" event on "'+ camera +'"');
          })
          .catch(function (error) {
           console.log('An error occured when trying to notify NX Witness:' + error);
          });
      }
    }
  }
  catch (e) {
    console.log('An error occured: ' + e);
  }
});
