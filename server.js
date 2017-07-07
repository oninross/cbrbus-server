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
    publicKey: 'BICxnXBM_YNm-XbMG2OWfotUv4roMv7yxsXiowl0QDYs8ERPPlUd4A1Tcd8S3sXI7WneX9c2mh1xxNAdIjKzy0I',
    privateKey: 'YQsK3rEMKv_RpectJAKZLpT1KxzQplVsLxSHxJ7dGP8'
};

const API_KEY = 'A6F762'; // Development
// const API_KEY = 'AE9887'; // Production

app.use(express.static(__dirname + '/'));
app.use(bodyParser.json());
app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept');
    res.header('Content-Type', 'application/json');
    res.header('Access-Control-Allow-Credentials', true);

    next();
});

app.get('/getPublicKey', function (req, res) {
    // A real world application would store the subscription info.
    console.log('hello world')
    res.json({ key: vapidKeys.publicKey });
});


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
                        stopPointRef,
                        vehicleRef,
                        vehicleRefNum;

                    $.each($vehicleActivity, function (i, v) {
                        $v = $(v);
                        stopPointRef = $v.find('StopPointRef');
                        vehicleRef = $v.find('VehicleRef');

                        if (stopPointRef[0] != undefined && vehicleRef[0] != undefined) {
                            console.log(stopPointRef[0].innerHTML + ' == ' +  busStopId);

                            if (stopPointRef[0].innerHTML == busStopId) {
                                isNextStop = true;
                                vehicleRefNum = vehicleRef[0].innerHTML;
                                return false;
                            }
                        }
                    });

                    if (isNextStop) {
                        clearInterval(refreshInterval);

                        var payload = [busId, vehicleRefNum];
                        payload = payload.toString();

                        webPush.sendNotification(
                            pushSubscriptions,
                            payload,
                            options
                        );
                        console.log('Send push notification::')
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

app.post('/getBusPath', function (req, res) {
    let request = req.body,
        busCoordinates = [];

    console.log('getBusPath::');

    jsdom.env('', ['http://code.jquery.com/jquery.min.js'], function (err, window) {
        var $ = window.$;
        $.support.cors = true;

        console.log('call')

        $.ajax({
            url: 'https://oninross.carto.com/api/v2/sql?q=WITH Q1 AS (SELECT t.shape_id , count(t.shape_id) total FROM routes r INNER JOIN trips t ON t.route_id = r.route_id WHERE r.route_short_name = ' + Number(request.busId) + ' AND t.direction_id = ' + request.busDir + ' GROUP BY t.shape_id) SELECT DISTINCT s.* FROM shapes s WHERE s.shape_id IN (SELECT shape_id FROM Q1 WHERE total = (SELECT MAX(total) FROM Q1))&api_key=f35be52ec1b8635c34ec7eab01827bb219750e7c',
            // url: 'https://oninross.carto.com/api/v2/sql?q=SELECT * FROM table_2_southbound&api_key=f35be52ec1b8635c34ec7eab01827bb219750e7c',
            success: function (data) {
                $.each(data.rows, function (i, v) {
                    busCoordinates.push({
                        lat: v.shape_pt_lat,
                        lng: v.shape_pt_lon
                    });
                });

                console.log('done')

                res.json({ busCoordinates: busCoordinates });
            },
            error: function (error) {
                console.log(error);
            }
        });
    });
});

app.listen(process.env.PORT || 8888, function () {
    console.log('Example app listening on port 8888!');
});
