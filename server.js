var $ = require('jquery'),
    jsdom = require("jsdom"),
    express = require('express'),
    app = express(),
    webPush = require('web-push'),
    bodyParser = require('body-parser'),
    vehicleRef,
    refreshInterval;

// const vapidKeys = webPush.generateVAPIDKeys();
const vapidKeys = {
    publicKey: 'BD4qD23xudO3P1vVExYZlblRFdlfwBLnwNkCkDz4Pr038FTCVZIZodsurySHNtfIdC6s18pu7rm2DNUfElI9j6Y',
    privateKey: 'tdYWdgT7W3kHb5TSeZcq_d16x3wkD3QTzWPUulAtQ0Y'
};

// const API_KEY = 'A6F762'; // Development
const API_KEY = 'AE9887'; // Production

app.use(express.static(__dirname + '/'));
app.use(bodyParser.json());
app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept');
    res.header('Content-Type', 'application/json');
    res.header('Access-Control-Allow-Credentials', true);

    next();
});

// app.get('/getPublicKey', function (req, res) {
//     // A real world application would store the subscription info.
//     res.json({ key: vapidKeys.publicKey });
// });


app.post('/register', function (req, res) {
    // A real world application would store the subscription info.
    res.sendStatus(201);
});

app.post('/sendNotification', function (req, res) {
    clearInterval(refreshInterval);

    const pushSubscriptions = {
        endpoint: req.body.endpoint,
        keys: {
            p256dh: req.body.key,
            auth: req.body.authSecret
        }
    },
    payload = '',
    options = {
        vapidDetails: {
            subject: 'mailto:cbrbusissues@gmail.com',
            publicKey: vapidKeys.publicKey,
            privateKey: vapidKeys.privateKey
        }
    };

    webPush.setGCMAPIKey('135415812168');

    var busId = req.body.busId,
        busStopId = req.body.busStopId,
        $xml = '';

    vehicleRef = req.body.vehicleRef;

    if (busId < 10) {
        busId = '000' + busId.toString();
    } else if (busId < 100) {
        busId = '00' + busId.toString();
    } else if (busId < 1000) {
        busId = '0' + busId.toString();
    }

    console.log('sendNotification::');
    jsdom.env('', ['http://code.jquery.com/jquery.min.js'], function (err, window) {
        var $ = window.$;
        $.support.cors = true;

        refreshInterval = setInterval(function () {
            console.log('refresh::');

            $.ajax({
                url: 'https://cors-anywhere.herokuapp.com/http://siri.nxtbus.act.gov.au:11000/' + API_KEY + '/vm/service.xml',
                data: '<?xml version="1.0" encoding="iso-8859-1" standalone="yes"?><Siri version="2.0" xmlns:ns2="http://www.ifopt.org.uk/acsb" xmlns="http://www.siri.org.uk/siri" xmlns:ns4="http://datex2.eu/schema/2_0RC1/2_0" xmlns:ns3="http://www.ifopt.org.uk/ifopt"><ServiceRequest><RequestTimestamp>' + new Date().toISOString() + '</RequestTimestamp><RequestorRef>' + API_KEY + '</RequestorRef><VehicleMonitoringRequest version="2.0"><RequestTimestamp>' + new Date().toISOString() + '</RequestTimestamp><VehicleMonitoringRef>VM_ACT_' + busId + '</VehicleMonitoringRef></VehicleMonitoringRequest></ServiceRequest></Siri>',
                type: 'POST',
                contentType: 'text/xml',
                dataType: "text",
                success: function (xml) {
                    console.log('success::');

                    var xmlDoc = $.parseXML(xml),
                        $xml = $(xmlDoc),
                        isNextStop = false;

                    // console.log(xmlDoc);
                    var $vehicleActivity = $xml.find('VehicleActivity'),
                        $v,
                        $vehicleLat,
                        $vehicleLng,
                        stopPointRef;

                    $.each($vehicleActivity, function (i, v) {
                        $v = $(v);
                        stopPointRef = $v.find('StopPointRef');

                        if (stopPointRef[0] != undefined && vehicleRef[0] != undefined) {
                            console.log(stopPointRef[0].innerHTML + ' == ' +  busStopId);

                            if (stopPointRef[0].innerHTML == busStopId) {
                                isNextStop = true;
                                return false;
                            }
                        }
                    });

                    if (isNextStop) {
                        clearInterval(refreshInterval);

                        webPush.sendNotification(
                            pushSubscriptions,
                            payload,
                            options
                        );
                    }
                },
                error: function (error) {
                    console.log(error);
                }
            });
        }, 10000);
    });

    res.send('OK');
});

app.listen(process.env.PORT || 8888, function () {
    console.log('Example app listening on port 8888!');
});
