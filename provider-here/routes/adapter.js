/**
 * Routing results adapter from Here to MaaS. Returns promise for JSON object.
 */
var Promise = require('bluebird');
var nextStartTime = 0,
    nextEndTime = 0;
constructFrom = [];
constuctTo = [];


// Define array prototype for adding next capability (used for extracting position)
Array.prototype.current = 0;
Array.prototype.next = function () {
        return this[this.current++];
    }
    //-----------------------------------------------------------------------------

function convertMode(data) {

    return (data.instruction).replace(/(<([^>]+)>)/ig, "");

    //return mode == 'publicTransport' ? 'PUBLIC' : undefined;
}

function convertFrom(leg, from) {

    constructFrom.push(from.position);
    position = constructFrom.next();

    return {
        name: leg.start.label,
        stopId: undefined,
        stopCode: undefined,
        lon: position.longitude,
        lat: position.latitude
            // excluded: zoneId, stopIndex, stopSequence, vertexType, arrival, departure
    };

}

function convertTo(to) {

    var lon;
    var lat;
    for (var i = 1; i < to.maneuver.length; i++) {
        constructTo.push(to.maneuver[i].position);
        if (i == to.maneuver.length - 1) {
            constructTo.push(to.maneuver[i].position);
        }
    }

    position = constructTo.next();

    return {
        name: to.end.label,
        stopId: undefined,
        stopCode: undefined,
        lon: position.longitude,
        lat: position.latitude
            // excluded: zoneId, stopIndex, stopSequence, vertexType, arrival, departure
    };

}



function convertLeg(leg, data, route, startTime) {

    nextStartTime = (nextEndTime == 0 ? nextEndTime + startTime : nextEndTime);
    nextEndTime = nextStartTime + data.travelTime;

    return {

        startTime: nextStartTime,
        endTime: nextEndTime,
        mode: convertMode(data),
        from: convertFrom(leg, data),
        to: convertTo(leg),
        legGeometry: undefined,
        route: undefined,
        routeShortName: undefined,
        routeLongName: undefined,
        agencyId: undefined

    };

}


function convertItinerary(route) {

    var startTime = new Date(route.summary.departure);
    var result = [];
    constructFrom = [];
    constructTo = [];

    return {
        startTime: startTime.getTime(),
        endTime: startTime.getTime() + route.summary.travelTime,
        legs: route.leg.map(function (leg) {

            leg.maneuver.forEach(function (data, index) {
                result.push(convertLeg(leg, data, route, startTime.getTime()));
            });

            return {
                maneuver: result
            };
        })
    };
}

function convertPlanFrom(original) {

    var from = undefined;

    if (original.response && original.response.route[0] && original.response.route[0].waypoint[0]) {
        var lon = (original.response.route[0].waypoint[0].originalPosition['longitude']).toFixed(5);
        var lat = (original.response.route[0].waypoint[0].originalPosition['latitude']).toFixed(5);
        from = {
            lon: lon,
            lat: lat
        }
        return from;
    }

}



module.exports = function (original) {
    return Promise.resolve({
        plan: {
            from: convertPlanFrom(original),
            itineraries: original.response.route.map(convertItinerary)
        }
    });
};