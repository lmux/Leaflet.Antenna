# Leaflet.Antenna

A leaflet plugin for displaying antenna sites and coverage.


## Demo 

[Basic antenna site](https://lmux.github.io/Leaflet.Antenna/)

## Motivation

Before Leaflet.Antenna, when configuring antenna networks users had to rely in proprietary software or services which limited the functionality to certain antennas or exposed their planned antenna configuration. 
Networks should be built and controlled by the people who use them, with tools that are freely available, without profiting off the necessity to communicate.

## Usage example

```javascript
    addGeoJSONToMap('map_example.geojson', map);
```
Parses the .geojson file and draws markers and geometries from feature collection on the map 

```javascript
    parseNetworkJSONFile('network_example_simple.json', map);
```
Parses the .json network file and draws antenna links and coverage for each antenna on the map

Example network configuration file: (without comments when used)
```json5
{
  "antenna_sites": [
    {
      "site_name": "site1",                   //must be the same value as the name property of a map marker where the antenna pattern is later drawn 
      "installed_antennas": [                 //see name property in map_example.geojson
        {
          "antenna_name": "site1_antenna1",   //name which is later used for links
          "point_dir": 225,                   //in degrees (facing north equals 0°,increasing clock-wise)
          "install_height": 15,               //meters above terrain 
          "antenna_profile": "Brand-AP-Gen2"  //must be the same value as a profile_name from antenna_profiles 
        }
      ]
    },
    {
      "site_name": "site2",                   //configuration can have multiple sites
      "installed_antennas": [                 //sites can have multiple antennas
        {
          "antenna_name": "site2_antenna1",
          "point_dir": 45,
          "install_height": 15,
          "antenna_profile": "Brand-AP-Gen2"
        }
      ]
    }
  ],
  "antenna_profiles": [                 
    {
      "profile_name": "Brand-AP-Gen2",  
      "output_power": 27,               //in dBw
      "gain": 19,                       //in dBi
      "sensitivity": 85,                //in dBw
      "ant_file": "Brand-AP-Gen2.ant",  //directory to .ant file
      "frequency": 2.4                  //in GHz
    }
  ],
  "antenna_links": [ //links are bidirectional
    {
      "antenna_from": "site1_antenna1", //must be the same value as a antenna_name from installed_antennas under antenna_sites
      "antenna_to": "site2_antenna1"
    }
  ]
}
```
## Dependencies / Used Leaflet Plugins

 The function `getElevation` requires a tileLayer `L.tileLayer.colorPicker` from the leaflet plugin [leaflet-tilelayer-colorpicker](https://github.com/frogcat/leaflet-tilelayer-colorpicker) to get the elevation at any point by using the function `getColor` of that tile layer. 
 
The function `drawRadiationPattern` requires a tileLayer `L.TileLayer.maskCanvas` from the leaflet plugin [leaflet-maskcanvas](https://github.com/domoritz/leaflet-maskcanvas) to draw the coverage on the tile layers, which are created in the function.


## TODO
-  increase calculation speed of the radiation patterns
-  eventually change the configuration file format to a format which supports comments if needed (probably JSON5)
-  make functions more modular
