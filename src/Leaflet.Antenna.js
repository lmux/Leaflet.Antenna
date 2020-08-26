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
 Calculates antenna coverage of the given transmitting antenna relative to a equally specified receiving antenna and obstacles.
 @param {number[]} antCords: the origin point of the antenna [lat,long], e.g. [51.33849, 12.40729]
 @param {number} antPointDir: the direction the antenna is pointing at in degrees, e.g. 0 (facing north)
 @param {number} antInstallHeight: the height above ground both antennas ar installed at
 @param {{ant_file: string,frequency: number,gain: number,output_power: number, profile_name: string, sensitivity: number}} antProfile: specifications of the antenna
 @returns {Number[][]} lists of reachable, unreachable and border points (with distance to antCords) of the radiation pattern [[(lat,long)]]
 */
async function calcRadPatternWithObstacles(antCords, antPointDir, antInstallHeight, antProfile) {

    //the directory of the .ant file of the antenna
    let antFile = antProfile.ant_file,
        //output power of the transmitting antenna in dBm
        outputPowerTXAntenna = antProfile.output_power,
        //sensitivity of the receiving antenna in dBm
        sensitivityRXAntenna = antProfile.sensitivity,
        //gain of the receiving antenna in dBi
        gainRXAntenna = antProfile.gain,
        //frequency both antennas operate on in GHz
        frequency = antProfile.frequency;
    //TODO: define defaults

    const radiationIDif = await parseAntFile(antFile);
    const outerBorder = calcRadPatternBorder(antCords, antPointDir, radiationIDif, outputPowerTXAntenna, sensitivityRXAntenna, gainRXAntenna, frequency);
    // const elevationTXAntenna = await getElevationAtPointRGB(antCords) + installHeight;
    const elevationTXAntenna = await getElevationAtPointRGB(antCords) + antInstallHeight;

    let goodReachablePoints = [];
    let okayReachablePoints = [];
    let badlyReachablePoints = [];

    let elevationAllPoints = [];
    //distance between two points in meters
    let stepSize = 50;
    for (let antennaAngle = 0; antennaAngle < 360; antennaAngle++) {

        //always has antCords as first point
        // let anglePoints = [{lat: antCords[0], lng: antCords[1], count: elevationTXAntenna}];
        let anglePoints = [{latLng: antCords, height: elevationTXAntenna}];
        let elevationMax = elevationTXAntenna;

        for (let distance = stepSize; distance <= outerBorder[antennaAngle][2]; distance += stepSize) {
            let newPoint = destination(antCords, antPointDir + antennaAngle, distance);
            let elevationAtPoint = await getElevationAtPointRGB(newPoint);
            let newPointWithHeight = {latLng: newPoint, height: elevationAtPoint};

            if (elevationAtPoint >= elevationMax) {
                //line of sight not obstructed
                elevationMax = elevationAtPoint;
                goodReachablePoints.push(newPoint);
            } else {
                //check if all previous points are under current line of sight
                function underLineOfSight(element, index) {
                    //y = mx+n , m: slopeLineOfSight, n: elevationTXAntenna
                    let slopeLineOfSight = (elevationAtPoint + antInstallHeight - elevationTXAntenna) / distance;
                    return element.height <= slopeLineOfSight * (index * stepSize) + elevationTXAntenna;
                }
                //check if all previous points are under the inner fresnel zone
                function underFirstFresnelZone(element, index) {
                    const distFromTXAntenna = index * stepSize;
                    //fresnelRadius == Math.sqrt((299792458 * distFromTXAntenna * (distance - distFromTXAntenna)) / (frequency * Math.pow(10, 9) * distance));
                    //reduced constant part: Math.sqrt(299792458 / Math.pow(10, 9)) == 0.5475331
                    let fresnelRadius = 0.5475331 * Math.sqrt((distFromTXAntenna * (distance - distFromTXAntenna)) / (frequency * distance));
                    let slopeLineOfSight = (elevationAtPoint + antInstallHeight - elevationTXAntenna) / distance;
                    return element.height <= slopeLineOfSight * distFromTXAntenna + elevationTXAntenna - fresnelRadius;
                }
                //check if all previous points are under the outer fresnel zone
                function underSecondFresnelZone(element, index) {
                    let distFromTXAntenna = index * stepSize;
                    //fresnelRadius == Math.sqrt((2* 299792458 * distFromTXAntenna * (distance - distFromTXAntenna)) / (frequency * Math.pow(10, 9) * distance));
                    //reduced constant part: Math.sqrt(2 * 299792458 / Math.pow(10, 9)) == 0.7743287
                    let fresnelRadius = 0.7743287 * Math.sqrt((distFromTXAntenna * (distance - distFromTXAntenna)) / (frequency * distance));
                    let slopeLineOfSight = (elevationAtPoint + antInstallHeight - elevationTXAntenna) / distance;
                    return element.count <= slopeLineOfSight * distFromTXAntenna + elevationTXAntenna - fresnelRadius;
                }

                //line of sight in all cases not obstructed
                if (anglePoints.every(underLineOfSight)) {
                    if (anglePoints.every(underFirstFresnelZone)) {
                        if (anglePoints.every(underSecondFresnelZone)) {
                            //no obstruction
                            goodReachablePoints.push(newPoint);
                        } else {
                            //only outer fresnel zone obstructed
                            okayReachablePoints.push(newPoint);
                        }
                    } else {
                        //both fresnel zones obstructed, but line of sight is clear
                        badlyReachablePoints.push(newPoint);
                    }
                }
                anglePoints.push(newPointWithHeight);
            }
        }
        elevationAllPoints = elevationAllPoints.concat(anglePoints);
    }
    return [goodReachablePoints, okayReachablePoints, badlyReachablePoints, outerBorder];
}
