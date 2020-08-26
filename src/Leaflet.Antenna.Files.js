/**
 Parses the .ant file and returns array with the gain value at each angle
 @param {string} antFile: .ant file
 @returns {number[]} gain value at each angle, starting at 0 and increasing by 1.
 */
async function parseAntFile(antFile) {
    return await fetch(antFile)
        .then(response => response.text())
        .then(data => data.split("\n"))
        .then(data => JSON.parse("[" + data + "]"));
}

/**
 Parses the .geojson file and draws markers and geometries from feature collection on the map with umap options if included
 @param {string} file: .geojson file
 @param {L.Map} map: leaflet map
 */
function addGeoJSONToMap(file, map) {
    fetch(
        file
    ).then(
        res => res.json()
    ).then(
        data => L.geoJson(data, {
            pointToLayer: function (feature, latlng) {
                //default overlayPane would conflict with clicking lines etc.
                return L.circleMarker(latlng, {pane: 'markerPane'});
            },
            style: setStyle
        }).addTo(map).bindPopup(function (layer) {
                return layer.feature.properties.name + "<br>" + layer.feature.properties.description;
            }
        )
    )
}

//for UMap custom styles
function setStyle(feature) {
    return feature.properties._umap_options;
}

/**
 Parses the .json network file and draws antenna links and coverage on the given map
 @param {string} file: .json file
 @param {L.Map} map: leaflet map
 @returns {object[][]} antenna data needed for radiation pattern
 */
async function parseNetworkJSONFile(file, map) {
    let antennaData = [];
    let networkData = await fetch(file).then(res => res.json());
    let markerNameAndPos = getMapMarkerNameAndPos(map);
    if (networkData.antenna_links) {
        for (const antenna_link of networkData.antenna_links) {
            let site_from = findSiteOfAntenna(antenna_link.antenna_from, networkData.antenna_sites);
            let site_to = findSiteOfAntenna(antenna_link.antenna_to, networkData.antenna_sites);

            let antenna_from = getPositionOfMarker(site_from, markerNameAndPos);
            let antenna_to = getPositionOfMarker(site_to, markerNameAndPos);

            if (antenna_from && antenna_to)
                L.polyline([antenna_from, antenna_to], {radius: 5}).addTo(map);
        }
    }
    if (networkData.antenna_sites) {
        for (const site of networkData.antenna_sites) {
            for (const antenna of site.installed_antennas) {
                let antennaProfile = getAntennaProfile(antenna.antenna_profile, networkData.antenna_profiles);
                let antennaPosition = getPositionOfMarker(site.site_name, markerNameAndPos);
                antenna.profile = antennaProfile;
                antenna.position = antennaPosition;
                antennaData.push(antenna);
            }
        }
    }
    return antennaData;
}

/**
 Returns the position of the given marker if the entry is included in the given array
 @param {string} markerName: name of the marker
 @param {{name: String,pos:number[]}[]} markerNameAndPosList: array containing marker names with their position
 @returns {number} position of the given marker if in array, else undefined
 */
function getPositionOfMarker(markerName, markerNameAndPosList) {
    let position;
    for (const marker of markerNameAndPosList) {
        if (marker.name === markerName) {
            position = marker.pos;
            break;
        }
    }
    return position;
}

/**
 Returns the profile of the given antenna if the entry is included in the given array
 @param {string} antennaModel: name of the antenna profile
 @param {{ant_file: string,frequency: number,gain: number,output_power: number, profile_name: string, sensitivity: number}[]} antennaProfiles: array of antenna specifications
 @returns {{ant_file: string,frequency: number,gain: number,output_power: number, profile_name: string, sensitivity: number}} antenna profile
 */
function getAntennaProfile(antennaModel, antennaProfiles) {
    let antennaProfile;
    for (const profile of antennaProfiles) {
        if (profile.profile_name === antennaModel) {
            antennaProfile = profile;
            break;
        }
    }
    return antennaProfile;
}

/**
 Returns a list of all named markers on the given map with their position
 @param {L.Map} map: leaflet map
 @returns {{name: string,pos: number[]}[]} array with all markers on the map with a name property and their position
 */
function getMapMarkerNameAndPos(map) {
    //TODO: instead of parsing whole map object, only pars extra created layer with markers (requires all markers to be added to that layer)
    let markerNameAndPos = [];
    for (let layerId in map._layers) {
        let layer = map._layers[layerId];
        if (layer.feature && layer.feature.geometry.type === "Point" && layer.feature.properties.name) {
            //switch geojson order (longitude,latitude) without altitude
            let latlng = layer.feature.geometry.coordinates.slice(0, 2).reverse();
            markerNameAndPos.push({name: layer.feature.properties.name, pos: latlng})
        }
    }
    return markerNameAndPos;
}

/**
 Finds the the site corresponding to the given antenna
 @param {string} antennaName
 @param {{installed_antennas}[]} antennaSites: list of all installed antennas on all sites
 @returns {string} name of the antenna site
 */
function findSiteOfAntenna(antennaName, antennaSites) {
    //TODO: Exception handling if site not found
    let site_name;
    outer_loop:
        for (const site of antennaSites) {
            for (const installed_antenna of site.installed_antennas) {
                if (installed_antenna.antenna_name === antennaName) {
                    site_name = site.site_name;
                    break outer_loop;
                }
            }
        }
    return site_name;
}

/**
 Calculates the elevation at the given location using the colorPicker tilelayer
 @param {number[]} location: point of interest, e.g. [51.33849, 12.40729]
 @returns {number} elevation at the given location
 */
async function getElevationAtPointRGB(location) {
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
 Draws antenna radiation pattern on the given map
 @param {latLng[][]} radiationPoints: holds good, okay and badly destination points as three seperate latLng arrays
 @param {L.Map} map: leaflet map
 */
function drawRadiationPattern(radiationPoints, map) {
    //create own pane that sits lower than default overlayPane
    if (!map.getPane('radiationPatternPane')) {
        map.createPane('radiationPatternPane').style.zIndex = '300';
    }

    L.TileLayer.maskCanvas()

    let layerGoodReachablePoints = L.TileLayer.maskCanvas({
        radius: 25,  // radius in pixels or in meters (see useAbsoluteRadius)
        useAbsoluteRadius: true,  // true: r in meters, false: r in pixels
        color: '#0a197b',  // the color of each point
        opacity: 0.5,  // opacity of the not covered area
        noMask: true  // true results in normal (filled) circled, instead masked circles
        //lineColor: '#0239ff'   // color of the circle outline if noMask is true
    });
    let layerOkayReachablePoints = L.TileLayer.maskCanvas({
        radius: 25,
        useAbsoluteRadius: true,
        color: '#235dd2',
        opacity: 0.5,
        noMask: true
    });
    let layerBadlyReachablePoints = L.TileLayer.maskCanvas({
        radius: 25,
        useAbsoluteRadius: true,
        color: '#681b80',
        opacity: 0.5,
        noMask: true
    });
    layerGoodReachablePoints.setData(radiationPoints[0]);
    layerOkayReachablePoints.setData(radiationPoints[1]);
    layerBadlyReachablePoints.setData(radiationPoints[2]);
    map.addLayer(layerGoodReachablePoints);
    map.addLayer(layerOkayReachablePoints);
    map.addLayer(layerBadlyReachablePoints);
}

