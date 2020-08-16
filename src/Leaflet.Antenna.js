/**
 Returns the point that is a distance and heading away from
 the given origin point.
 @param {number[]} latlng: origin point [lat,long]
 @param {number} heading: heading in degrees, clockwise from 0 degrees north.
 @param {number} distance: distance in meters
 @returns {number[]} the destination point [lat,long].
 Many thanks to Chris Veness at http://www.movable-type.co.uk/scripts/latlong.html
 for a great reference and examples.
 source: http://makinacorpus.github.io/Leaflet.GeometryUtil/leaflet.geometryutil.js.html#line713, Copyright (c) 2013, Makina Corpus
 */
function destination(latlng, heading, distance) {
    heading = (heading + 360) % 360;
    let rad = Math.PI / 180,
        radInv = 180 / Math.PI,
        R = 6378137, // approximation of Earth's radius
        lon1 = latlng[1] * rad,
        lat1 = latlng[0] * rad,
        rheading = heading * rad,
        sinLat1 = Math.sin(lat1),
        cosLat1 = Math.cos(lat1),
        cosDistR = Math.cos(distance / R),
        sinDistR = Math.sin(distance / R),
        lat2 = Math.asin(sinLat1 * cosDistR + cosLat1 *
            sinDistR * Math.cos(rheading)),
        lon2 = lon1 + Math.atan2(Math.sin(rheading) * sinDistR *
            cosLat1, cosDistR - sinLat1 * Math.sin(lat2));
    lon2 = lon2 * radInv;
    lon2 = lon2 > 180 ? lon2 - 360 : lon2 < -180 ? lon2 + 360 : lon2;
    return [lat2 * radInv, lon2];
}

/**
 Calculates the maximum distance between both antennas disregarding obstacles in between.
 @param {number} frequency: frequency both antennas operate on in GHz
 @param {number} outputPowerTXAntenna: output power of the transmitting antenna in dBw
 @param {number} sensitivityRXAntenna: sensitivity of the receiving antenna in dBw
 @param {number} gainTxAntenna: gain of the transmitting antenna in dBw
 @param {number} gainRxAntenna: gain of the receiving antenna in dBw
 @returns {number} maximum distance between antennas in meters
 */
function maxDistance(frequency, outputPowerTXAntenna, sensitivityRXAntenna, gainTxAntenna, gainRxAntenna) {
    //distance where FSPL - outputPowerTXAntenna - gainTxAntenna - gainRxAntenna == sensitivityRXAntenna
    let maxSignalLoss = outputPowerTXAntenna + gainTxAntenna + gainRxAntenna + sensitivityRXAntenna;
    //solved FSPL for r with FSPL being maxSignalLoss, reduced constant part: -32.44778322/20 == -1.62238
    return Math.pow(10, (maxSignalLoss / 20 - 1.62238 - Math.log10(frequency)));
}

/**
 Calculates the free space path loss between two antennas.
 @param {number} distance: distance from antenna in meters
 @param {number} frequency: frequency both antennas operate on in GHz
 @param {number} gainTxAntenna: gain of the transmitting antenna in dBw
 @param {number} gainRxAntenna: gain of the receiving antenna in dBw
 @returns {number} free space path loss in dBw with a precision of 4 after decimal point
 */
function freeSpacePathLoss(distance, frequency, gainTxAntenna, gainRxAntenna) {
    //FSPL := 20 * Math.log10(distance) + 20 * Math.log10(frequency * Math.pow(10, 9)) + 20 * Math.log10((4 * Math.PI) / 299792458)) + gains
    //reduced constant part: 20*log10(10^9)+20*log10((4*Pi)/299792458)) == 32.44778322
    return 20 * Math.log10(distance) + 20 * Math.log10(frequency) + 32.44778 - gainTxAntenna - gainRxAntenna;
}

/**
 Calculates the radiation pattern border of the transmitting antenna relative to the receiving antenna and obstacles.
 @param {number[]} center: the origin point of the antenna [lat,long], e.g. [51.33849, 12.40729]
 @param {number} pointDir: the direction the antenna is pointing at in degrees, e.g. 0 (facing north)
 @param {number[]} radiationIDif: the radiation pattern values per angle, starting from 0° to 360°
 @param {number} outputPowerTXAntenna: output power of the transmitting antenna in dBm
 @param {number} sensitivityRXAntenna: sensitivity of the receiving antenna in dBm
 @param {number} gainRXAntenna: gain of the receiving antenna in dBi
 @param {number} frequency: frequency both antennas operate on in GHz
 @returns {Number[][]} list of border points of the radiation pattern with the distance from center [[lat,long,distance]]
 */
function calcRadPatternBorder(center, pointDir, radiationIDif, outputPowerTXAntenna, sensitivityRXAntenna, gainRXAntenna, frequency) {

    let outerborder = [];

    for (let antennaAngle = 0; antennaAngle < 360; antennaAngle++) {
        let gainTXAntenna = radiationIDif[antennaAngle];
        let distanceToOuterBorder = maxDistance(frequency, outputPowerTXAntenna, sensitivityRXAntenna, gainTXAntenna, gainRXAntenna);
        outerborder.push(destination(center, pointDir + antennaAngle, distanceToOuterBorder).concat(distanceToOuterBorder));
    }
    return outerborder;
}

/**
 Calculates the elevation at the given location
 @param {number[]} location: point of interest, e.g. [51.33849, 12.40729]
 @returns {number} elevation at the given location
 */
function getElevation(location) {
    //TODO: fully initialize requested tiles before using getColor (currently tiles have to be loaded beforehand by looking at the map region)
    //modify leaflet-tilelayer-colorpicker to execute this._update function when tile is not loaded with setTimeout until loaded
    //TODO: use try/catch for NaN exceptions
    let colorAsRGBA = colorPicker.getColor(location);
    let h;
    if (colorAsRGBA !== null) {
        h = -10000 + ((colorAsRGBA[0] * 256 * 256 + colorAsRGBA[1] * 256 + colorAsRGBA[2]) * 0.1);
    }
    return isNaN(h) ? NaN : Number(h.toFixed(2));
}

/**
 Calculates the radiation pattern of the transmitting antenna relative to the receiving antenna and obstacles.
 @param {number[]} center: the origin point of the antenna [lat,long], e.g. [51.33849, 12.40729]
 @param {number} pointDir: the direction the antenna is pointing at in degrees, e.g. 0 (facing north)
 @param {number} installHeight: the height above ground both antennas ar installed at
 @param {string} antFile: the directory of the .ant file of the antenna
 @param {number} outputPowerTXAntenna: output power of the transmitting antenna in dBm
 @param {number} sensitivityRXAntenna: sensitivity of the receiving antenna in dBm
 @param {number} gainRXAntenna: gain of the receiving antenna in dBi
 @param {number} frequency: frequency both antennas operate on in GHz
 @returns {Number[][]} lists of reachable, unreachable and border points (with distance to center) of the radiation pattern [[(lat,long)]]
 */
async function calcRadPatternWithObstacles(center, pointDir, installHeight, antFile, outputPowerTXAntenna, sensitivityRXAntenna, gainRXAntenna, frequency) {

    const radiationIDif = await parseAntFile(antFile);
    const outerBorder = calcRadPatternBorder(center, pointDir, radiationIDif, outputPowerTXAntenna, sensitivityRXAntenna, gainRXAntenna, frequency);
    const elevationTXAntenna = getElevation(center) + installHeight;

    let heatMapReachablePoints = [];
    let heatMapPartlyReachablePoints = [];

    //distance between two points in meters
    let stepSize = 50;
    for (let antennaAngle = 0; antennaAngle < 360; antennaAngle++) {

        //always has center as first point
        let anglePoints = [{lat: center[0], lng: center[1], count: elevationTXAntenna}];
        let elevationMax = elevationTXAntenna;

        for (let distance = stepSize; distance <= outerBorder[antennaAngle][2]; distance += stepSize) {
            let newPoint = destination(center, pointDir + antennaAngle, distance);
            let elevationAtPoint = getElevation(newPoint);
            let newPointWithHeight = {lat: newPoint[0], lng: newPoint[1], count: elevationAtPoint};

            if (elevationAtPoint >= elevationMax) {
                //line of sight not obstructed
                elevationMax = elevationAtPoint;
                heatMapReachablePoints.push(newPoint);
            } else {
                //case 1.2: check if all previous points are under current line of sight
                function underLineOfSight(element, index) {
                    //y = mx+n , m: slopeLineOfSight, n: elevationTXAntenna
                    let slopeLineOfSight = (elevationAtPoint + installHeight - elevationTXAntenna) / distance;
                    return element.count <= slopeLineOfSight * (index * stepSize) + elevationTXAntenna;
                }
                //check if all previous points are under the lowest fresnel zone
                function underFirstFresnelZone(element, index) {
                    const distFromTXAntenna = index * stepSize;
                    //fresnelRadius == Math.sqrt((299792458 * distFromTXAntenna * (distance - distFromTXAntenna)) / (frequency * Math.pow(10, 9) * distance));
                    //reduced constant part: Math.sqrt(299792458 / Math.pow(10, 9)) == 0.5475331
                    let fresnelRadius = 0.5475331 * Math.sqrt((distFromTXAntenna * (distance - distFromTXAntenna)) / (frequency * distance));
                    let slopeLineOfSight = (elevationAtPoint + installHeight - elevationTXAntenna) / distance;
                    return element.count <= slopeLineOfSight * distFromTXAntenna + elevationTXAntenna - fresnelRadius;
                }
                if (anglePoints.every(underLineOfSight)) {
                    if (anglePoints.every(underFirstFresnelZone)) {
                        //heatMapReachablePoints.push({lat: newPoint[0], lng: newPoint[1],count: 1});
                        heatMapReachablePoints.push(newPoint);
                    } else {
                        //lower fresnel zone obstructed, but line of sight is clear
                        heatMapPartlyReachablePoints.push(newPoint);
                    }
                }
                anglePoints.push(newPointWithHeight);
            }
        }
    }
    return [heatMapReachablePoints, heatMapPartlyReachablePoints, outerBorder];
}
