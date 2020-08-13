/*
    MIT License

    Copyright (c) 2017 Yuzo Matsuzawa

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
*/
//changed all 'var' to 'const' or 'let'
(function() {
    L.TileLayer.ColorPicker = L.TileLayer.extend({
        options: {
            crossOrigin: "anonymous"
        },
        getColor: function(latlng) {
            const size = this.getTileSize();
            const point = this._map.project(latlng, this._tileZoom).floor();
            let coords = point.unscaleBy(size).floor();
            const offset = point.subtract(coords.scaleBy(size));
            coords.z = this._tileZoom;
            const tile = this._tiles[this._tileCoordsToKey(coords)];
            if (!tile || !tile.loaded) return null;
            try {
                let canvas = document.createElement("canvas");
                canvas.width = 1;
                canvas.height = 1;
                let context = canvas.getContext('2d');
                context.drawImage(tile.el, -offset.x, -offset.y, size.x, size.y);
                return context.getImageData(0, 0, 1, 1).data;
            } catch (e) {
                return null;
            }
        }
    });
    L.tileLayer.colorPicker = function(url, options) {
        return new L.TileLayer.ColorPicker(url, options);
    };
})();
