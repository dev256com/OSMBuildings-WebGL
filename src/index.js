var APP, GL; // TODO: make them local references

/**
 * OSMBuildings
 * @OSMBuildings
 * @param {Object} options
 */

/*
 * NOTE: OSMBuildings cannot use a single global world coordinate system.
 *       The numerical accuracy required for such a system would be about
 *       32bits to represent world-wide geometry faithfully within a few
 *       centimeters of accuracy. Most computations in OSMBuildings, however,
 *       are performed on a GPU where only IEEE floats with 23bits of accuracy
 *       (plus 8 bits of range) are available.
 *       Instead, OSMBuildings' coordinate system has a reference point
 *       (APP.position) at the viewport center, and all world positions are
 *       expressed as distances in meters from that reference point. The
 *       reference point itself shifts with map panning so that all world
 *       positions relevant to the part of the world curently rendered on-screen
 *       can accurately be represented within the limited accuracy of IEEE floats. */

/**
 * OSMBuildings
 * @constructor
 * @param {Object} [options] - OSMBuildings options
 * @param {Integer} [options.minZoom=10] - Minimum allowed zoom
 * @param {Integer} [options.maxZoom=20] - Maxiumum allowed zoom
 * @param {Object} [options.bounds] - A bounding box to restrict the map to
 * @param {Boolean} [options.state=false] - Store the map state in the URL
 * @param {Boolean} [options.disabled=false] - Disable user input
 * @param {String} [options.attribution] - An attribution string
 * @param {Float} [options.zoom=minZoom] - Initial zoom
 * @param {Float} [options.rotation=0] - Initial rotation
 * @param {Float} [options.tilt=0] - Initial tilt
 * @param {Object} [options.position] - Initial position
 * @param {Float} [options.position.latitude=52.520000]
 * @param {Float} [options.position.latitude=13.410000]

 * @param {String} [options.baseURL='.'] - For locating assets. This is relative to calling page
 * @param {Boolean} [options.showBackfaces=false] - Render front and backsides of polygons. false increases performance, true might be needed for bad geometries
 * @param {String} [options.fogColor='#e8e0d8'] - Color to be used for sky gradients and distance fog
 * @param {String} [options.backgroundColor='#efe8e0'] - Overall background color
 * @param {Boolean} [options.fastMode=false] - Enables faster rendering at cost of image quality. If performance is an issue, consider also removing effects
 * @param {Array} [options.effects=[]] - Which effects to enable. The only effect at the moment is 'shadows'
 * @param {Object} [options.style={ color: 'rgb(220, 210, 200)' }] - Sets the default building style
 */

// TODO: check minZoom, maxZoom, attribution for duplicate meaning
// <a href="http://osmbuildings.org">© OSM Buildings</a>'

var OSMBuildings = function(options) {
  APP = this; // refers to 'this'. Should make other globals obsolete.

  APP.options = (options || {});

  if (APP.options.style) {
    APP.setStyle(APP.options.style);
  }

  APP.baseURL = APP.options.baseURL || '.';

  render.backgroundColor = new Color(APP.options.backgroundColor || BACKGROUND_COLOR).toArray();
  render.fogColor        = new Color(APP.options.fogColor        || FOG_COLOR).toArray();
  render.highlightColor  = new Color(APP.options.highlightColor  || HIGHLIGHT_COLOR).toArray();

  render.Buildings.showBackfaces = APP.options.showBackfaces;

  render.effects = {};
  var effects = APP.options.effects || [];
  for (var i = 0; i < effects.length; i++) {
    render.effects[ effects[i] ] = true;
  }

  APP.attribution = APP.options.attribution || OSMBuildings.ATTRIBUTION;

  APP.minZoom = parseFloat(APP.options.minZoom) || 10;
  APP.maxZoom = parseFloat(APP.options.maxZoom) || 20;
  if (APP.maxZoom < APP.minZoom) {
    APP.maxZoom = APP.minZoom;
  }

  APP.bounds = APP.options.bounds;

  APP.position = APP.options.position || { latitude: 52.520000, longitude: 13.410000 };
  APP.zoom = APP.options.zoom || APP.minZoom;
  APP.rotation = APP.options.rotation || 0;
  APP.tilt = APP.options.tilt || 0;

  APP.layers = [];

  if (APP.options.disabled) {
    APP.setDisabled(true);
  }
};

OSMBuildings.VERSION = '{{VERSION}}';
OSMBuildings.ATTRIBUTION = '<a href="http://osmbuildings.org">© OSM Buildings</a>';

OSMBuildings.prototype = {

  /**
   * Adds the OSMBuildings to DOM container
   * @public
   * @param {HTMLElement|String} DOM container or its id to append the map to
   */
  appendTo: function(container) {
    if (typeof container === 'string') {
      container = document.getElementById(container);
    }

    APP.width = container.offsetWidth;
    APP.height = container.offsetHeight;
    
    var canvas = document.createElement('CANVAS');
    canvas.className = 'osmb-viewport';
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
    container.appendChild(canvas);

    GL = GLX.getContext(canvas);

    Events.init(container);

    APP.getStateFromUrl();
    if (APP.options.state) {
      APP.setStateToUrl();
      APP.on('change', APP.setStateToUrl);
    }

    APP.attributionContainer = document.createElement('DIV');
    APP.attributionContainer.className = 'osmb-attribution';
    container.appendChild(APP.attributionContainer);
    APP.updateAttribution();

    APP.setDate(new Date());
    render.start();

    return APP;
  },

  /**
   * Removes the OSMBuildings object from the map
   */
  // TODO: test this
  remove: function() {
    render.stop();
    GLX.destroy();
  },

  /**
   * A function that will be called when an event is fired. The parameters passed to the function
   * depend on what type of event it is
   * @callback OSMBuildings~eventListenerFunction
   */
  /**
   * Adds an event listener
   * @param {String} event - An event identifier to listen for
   * @param {OSMBuildings~eventListenerFunction} callback
   */
  on: function(type, fn) {
    GL.canvas.addEventListener(type, fn);
    return APP;
  },

  /**
   * Removes event listeners
   * @param {String} event - An event identifier to listen for
   * @param {OSMBuildings~eventListenerFunction} [fn] - If given, only remove the given function
   */
  off: function(type, fn) {
    GL.canvas.removeEventListener(type, fn);
  },

  emit: function(type, detail) {
    var event = new CustomEvent(type, { detail:detail });
    GL.canvas.dispatchEvent(event);
  },

  /**
   * Sets the map style
   * @param {Object} style
   * @param {String} [style.color] - The color for buildings
   */
  setStyle: function(style) {
    // TODO
    //render.backgroundColor = new Color(options.backgroundColor || BACKGROUND_COLOR).toArray();
    //render.fogColor        = new Color(options.fogColor        || FOG_COLOR).toArray();
    //render.highlightColor  = new Color(options.highlightColor  || HIGHLIGHT_COLOR).toArray();

    DEFAULT_COLOR = style.color || style.wallColor || DEFAULT_COLOR;
    // TODO: is color valid?
    // DEFAULT_COLOR = color.toArray();
    return APP;
  },

  /**
   * Sets the date for shadow calculations
   * @param {Date} date
   */
  setDate: function(date) {
    Sun.setDate(typeof date === 'string' ? new Date(date) : date);
    return APP;
  },

  // TODO: this should be part of the underlying map engine
  /**
   * Returns the screen position of the point
   * @param {Float} latitude - Latitude of the point
   * @param {Float} longitude - Longitude of the point
   * @param {Float} elevation - Elevation of the point
   */
  project: function(latitude, longitude, elevation) {
    var
      metersPerDegreeLongitude = METERS_PER_DEGREE_LATITUDE *
                                 Math.cos(APP.position.latitude / 180 * Math.PI),
      worldPos = [ (longitude- APP.position.longitude) * metersPerDegreeLongitude,
                  -(latitude - APP.position.latitude)  * METERS_PER_DEGREE_LATITUDE,
                    elevation                          * HEIGHT_SCALE ];
    // takes current cam pos into account.
    var posNDC = transformVec3( render.viewProjMatrix.data, worldPos);
    posNDC = mul3scalar( add3(posNDC, [1, 1, 1]), 1/2); // from [-1..1] to [0..1]

    return { x:    posNDC[0]  * APP.width,
             y: (1-posNDC[1]) * APP.height,
             z:    posNDC[2]
    };
  },

  // TODO: this should be part of the underlying map engine
  /**
   * Returns the geographic position (latitude/longitude) of the map layer
   * (elevation==0) at viewport position (x,y), or 'undefined' if no part of the
   * map plane would be rendered at (x,y) - e.g. if (x,y) lies above the horizon.
   * @param {Integer} x - the x position in the viewport
   * @param {Integer} y - the y position in the viewport
   */
  unproject: function(x, y) {
    var inverse = GLX.Matrix.invert(render.viewProjMatrix.data);
    /* convert window/viewport coordinates to NDC [0..1]. Note that the browser
     * screen coordinates are y-down, while the WebGL NDC coordinates are y-up,
     * so we have to invert the y value here */
    var posNDC = [x/APP.width, 1-y/APP.height];
    posNDC = add2( mul2scalar(posNDC, 2.0), [-1, -1, -1]); // [0..1] to [-1..1];
    var worldPos = getIntersectionWithXYPlane(posNDC[0], posNDC[1], inverse);
    if (worldPos === undefined) {
      return;
    }
    metersPerDegreeLongitude = METERS_PER_DEGREE_LATITUDE *
                               Math.cos(APP.position.latitude / 180 * Math.PI);

    return {
      latitude:  APP.position.latitude - worldPos[1]/ METERS_PER_DEGREE_LATITUDE,
      longitude: APP.position.longitude+ worldPos[0]/ metersPerDegreeLongitude
    };
  },

  /**
   * Adds an OBJ (3D object) file to the map
   * Important: objects with same url are cached and only loaded once
   * @param {String} url - URL of the OBJ file
   * @param {Object} position - Where to render the OBJ
   * @param {Float} position.latitude - Latitude for the OBJ
   * @param {Float} position.longitude - Longitude for the OBJ
   * @param {Object} [options] - Options for rendering the OBJ
   * @param {Integer} [options.scale=1] - Scale the model by this value before rendering
   * @param {Integer} [options.rotation=0] - Rotate the model by this much before rendering
   * @param {Integer} [options.elevation=<ground height>] - The height above ground to place the model at
   * @param {String} [options.id] - An identifier for the object. This is used for getting info about the object later
   * @param {String} [options.color] - A color to apply to the model
   */
  addOBJ: function(url, position, options) {
    return new mesh.OBJ(url, position, options);
  },

  /**
   * A function that will be called on each feature, for modification before rendering
   * @callback OSMBuildings~modifierFunction
   * @param {String} id - The feature's id
   * @param {Object} properties - The feature's properties
   */
  /**
   * Adds a GeoJSON layer to the map
   * @param {String} url - URL of the GeoJSON file
   * @param {Object} options - Options to apply to the GeoJSON being rendered
   * @param {Integer} [options.scale=1] - Scale the model by this value before rendering
   * @param {Integer} [options.rotation=0] - Rotate the model by this much before rendering
   * @param {Integer} [options.elevation=<ground height>] - The height above ground to place the model at
   * @param {String} [options.id] - An identifier for the object. This is used for getting info about the object later
   * @param {String} [options.color] - A color to apply to the model
   * @param {OSMBuildings~modifierFunction} [options.modifier] - A function that will get called on each feature, for modification before rendering
   */
  addGeoJSON: function(url, options) {
    return new mesh.GeoJSON(url, options);
  },

  // TODO: allow more data layers later on
  /**
   * Adds a GeoJSON tile base layer, for rendering the 3D buildings
   * @param {String} url - The URL of the GeoJSON tile server, in {@link https://github.com/OSMBuildings/OSMBuildings/blob/master/docs/server.md the correct format}
   * @param {Object} options
   * @param {Integer} [options.fixedZoom=15]
   * @param {Object} [options.bounds] - Currently not used
   * @param {String} [options.color] - A color to apply to all features on this layer
   * @param {OSMBuildings~modifierFunction} [options.modifier] - A function that will get called on each feature, for modification before rendering
   * @param {Integer} [options.minZoom=14.5] - The minimum zoom level to show features from this layer
   * @param {Integer} [options.maxZoom] - The maxiumum zoom level to show features from this layer
   */
  addGeoJSONTiles: function(url, options) {
    options = options || {};
    options.fixedZoom = options.fixedZoom || 14.5;
    APP.dataGrid = new Grid(url, data.Tile, options);
    return APP.dataGrid;
  },

  /**
   * Adds a 2D map source, to render below the 3D buildings
   * @param {String} url - The URL of the map server. This could be Mapbox, or {@link https://wiki.openstreetmap.org/wiki/Tiles any other tile server} that supports the right format
   * @param {Object} options
   * @param {Integer} [options.fixedZoom]
   * @param {Object} [options.bounds] - Currently not used
   * @param {String} [options.color] - A color to apply to all features on this layer
   * @param {OSMBuildings~modifierFunction} [options.modifier] - A function that will get called on each feature, for modification before rendering
   * @param {Integer} [options.minZoom] - The minimum zoom level to show features from this layer
   * @param {Integer} [options.maxZoom] - The maxiumum zoom level to show features from this layer
   */
  addMapTiles: function(url, options) {
    APP.basemapGrid = new Grid(url, basemap.Tile, options);
    return APP.basemapGrid;
  },

  /**
   * Highlight a given feature by id. Currently, the highlight can only be applied to one feature. Set color = `null` in order to un-highlight
   * @param {String} id - The feature's id. For OSM buildings, it's the OSM id. For other objects, it's whatever's defined in the options passed to it.
   */
  highlight: function(id) {
    render.Buildings.highlightID = id ? render.Picking.idToColor(id) : null;
    return APP;
  },

  // TODO: check naming. show() suggests it affects the layer rather than objects on it
  /**
   * A function that will be called on each feature, for modification before rendering
   * @callback OSMBuildings~selectorFunction
   * @param {String} id - The feature's id
   * @param {Object} data - The feature's data
   */
  /**
   * Sets a function that defines which objects to show on this layer
   * @param {OSMBuildings~selectorFunction} selector - A function that will get run on each feature, and returns a boolean indicating whether or not to show the feature
   * @param {Integer} [duration=0] - How long to show the feature for
   */
  show: function(selector, duration) {
    Filter.remove('hidden', selector, duration);
    return APP;
  },

  // TODO: check naming. hide() suggests it affects the layer rather than objects on it
 /**
  * Sets a function that defines which objects to hide on this layer
  * @param {OSMBuildings~selectorFunction} selector - A function that will get run on each feature, and returns a boolean indicating whether or not to hide the feature
  * @param {Integer} [duration=0] - How long to hide the feature for
  */
  hide: function(selector, duration) {
    Filter.add('hidden', selector, duration);
    return APP;
  },

  /**
   * A callback function for getTarget
   * @callback OSMBuildings~getTargetCallback
   * @param {Object} feature - The feature
   */
  /**
   * Returns the feature from a position on the screen
   * @param {Integer} x - The x coordinate (in pixels) of position on the screen
   * @param {Integer} y - The y coordinate (in pixels) of position on the screen
   * @param {OSMBuildings~getTargetCallback} callback - A callback function that receives the object
   */
  getTarget: function(x, y, callback) {
    // TODO: use promises here
    render.Picking.getTarget(x, y, callback);
    return APP;
  },

  /**
   * A callback function for screnshot
   * @callback OSMBuildings~screenshotCallback
   * @param screenshot - The screenshot
   */
  /**
   * Take a screenshot
   * @param {OSMBuildings~screenshotCallback} callback - A callback function that receives the screenshot
   */
  screenshot: function(callback) {
    // TODO: use promises here
    render.screenshotCallback = callback;
    return APP;
  },

  /**
   * @private
   */
  updateAttribution: function() {
    var attribution = [];
    if (APP.attribution) {
      attribution.push(APP.attribution);
    }
    for (var i = 0; i < APP.layers.length; i++) {
      if (APP.layers[i].attribution) {
        attribution.push(APP.layers[i].attribution);
      }
    }
    APP.attributionContainer.innerHTML = attribution.join(' · ');
  },

  /**
   * @private
   */
  getStateFromUrl: function() {
    var
      query = location.search,
      state = {};
    if (query) {
      query.substring(1).replace(/(?:^|&)([^&=]*)=?([^&]*)/g, function($0, $1, $2) {
        if ($1) {
          state[$1] = $2;
        }
      });
    }

    APP.setPosition((state.lat !== undefined && state.lon !== undefined) ? { latitude:state.lat, longitude:state.lon } : APP.position);
    APP.setRotation(state.zoom !== undefined ? state.zoom : APP.zoom);
    APP.setZoom(state.rotation !== undefined ? state.rotation : APP.rotation);
    APP.setTilt(state.tilt !== undefined ? state.tilt : APP.tilt);
  },

  /**
   * @private
   */
  setStateToUrl: function() {
    if (!history.replaceState || APP.stateDebounce) {
      return;
    }

    APP.stateDebounce = setTimeout(function() {
      APP.stateDebounce = null;
      var params = [];
      params.push('lat=' + APP.position.latitude.toFixed(6));
      params.push('lon=' + APP.position.longitude.toFixed(6));
      params.push('zoom=' + APP.zoom.toFixed(1));
      params.push('tilt=' + APP.tilt.toFixed(1));
      params.push('rotation=' + APP.rotation.toFixed(1));
      history.replaceState({}, '', '?' + params.join('&'));
    }, 1000);
  },

  setDisabled: function(flag) {
    Events.disabled = !!flag;
    return APP;
  },

  isDisabled: function() {
    return !!Events.disabled;
  },

  /* returns the geographical bounds of the current view.
   * notes:
   * - since the bounds are always axis-aligned they will contain areas that are
   /**
   * Returns the geographical bounds of the current view.
   * Notes:
   * - Since the bounds are always axis-aligned they will contain areas that are
   *   not currently visible if the current view is not also axis-aligned.
   * - The bounds only contain the map area that OSMBuildings considers for rendering.
   *   OSMBuildings has a rendering distance of about 3.5km, so the bounds will
   *   never extend beyond that, even if the horizon is visible (in which case the
   *   bounds would mathematically be infinite).
   * - the bounds only consider ground level. For example, buildings whose top
   *   is seen at the lower edge of the screen, but whose footprint is outside
   * - The bounds only consider ground level. For example, buildings whose top
   *   is seen at the lower edge of the screen, but whose footprint is outside
   *   of the current view below the lower edge do not contribute to the bounds.
   *   so their top may be visible and they may still be out of bounds.
   */
  getBounds: function() {
    var viewQuad = render.getViewQuad(), res = [];
    for (var i in viewQuad) {
      res[i] = getPositionFromLocal(viewQuad[i]);
    }
    return res;
  },

  /**
   * Sets the zoom level
   * @param {Float} zoom - The new zoom level
   * @param {Object} e - **Not currently used**
   * @fires OSMBuildings#zoom
   * @fires OSMBuildings#change
   */
  setZoom: function(zoom, e) {
    zoom = clamp(parseFloat(zoom), APP.minZoom, APP.maxZoom);

    if (APP.zoom !== zoom) {
      APP.zoom = zoom;

      /* if a screen position was given for which the geographic position displayed
       * should not change under the zoom */
      if (e) {
        // FIXME: add code; this needs to take the current camera (rotation and
        //        perspective) into account
        // NOTE:  the old code (comment out below) only works for north-up
        //        non-perspective views
        /*
         var dx = APP.container.offsetWidth/2  - e.clientX;
         var dy = APP.container.offsetHeight/2 - e.clientY;
         APP.center.x -= dx;
         APP.center.y -= dy;
         APP.center.x *= ratio;
         APP.center.y *= ratio;
         APP.center.x += dx;
         APP.center.y += dy;*/
      }
      /**
       * Fired when the map is zoomed (in either direction)
       * @event OSMBuildings#zoom
       */
      APP.emit('zoom', { zoom: zoom });

      /**
       * Fired when the map is zoomed, tilted or panned
       * @event OSMBuildings#change
       */
      APP.emit('change');
    }
    return APP;
  },

  /**
   * Returns the current zoom level
   */
  getZoom: function() {
    return APP.zoom;
  },

  /**
   * Sets the map's geographic position
   * @param {Object} pos - The new position
   * @param {Float} pos.latitude
   * @param {Float} pos.longitude
   * @fires OSMBuildings#change
   */
  setPosition: function(pos) {
    var lat = parseFloat(pos.latitude);
    var lon = parseFloat(pos.longitude);
    if (isNaN(lat) || isNaN(lon)) {
      return;
    }
    APP.position = { latitude: clamp(lat, -90, 90), longitude: clamp(lon, -180, 180) };
    APP.emit('change');
    return APP;
  },

  /**
   * Returns the map's current geographic position
   */
  getPosition: function() {
    return APP.position;
  },

  /**
   * Sets the map's size
   * @param {Object} size
   * @param {Integer} size.width
   * @param {Integer} size.height
   * @fires OSMBuildings#resize
   */
  setSize: function(size) {
    if (size.width !== APP.width || size.height !== APP.height) {
      APP.width = size.width;
      APP.height = size.height;

      /**
       * Fired when the map is resized
       * @event OSMBuildings#resize
       */
      APP.emit('resize', { width: APP.width, height: APP.height });
    }
    return APP;
  },

  /**
   * Returns the map's current size
   */
  getSize: function() {
    return { width: APP.width, height: APP.height };
  },

  /**
   * Set's the maps rotation
   * @param {Float} rotation - The new rotation angle
   * @fires OSMBuildings#rotate
   * @fires OSMBuildings#change
   */
  setRotation: function(rotation) {
    rotation = parseFloat(rotation)%360;
    if (APP.rotation !== rotation) {
      APP.rotation = rotation;

      /**
       * Fired when the map is rotated
       * @event OSMBuildings#rotate
       */
      APP.emit('rotate', { rotation: rotation });
      APP.emit('change');
    }
    return APP;
  },

  /**
   * Returns the maps current rotation
   */
  getRotation: function() {
    return APP.rotation;
  },

  /**
   * Sets the map's tilt
   * @param {Float} tilt - The new tilt
   * @fires OSMBuildings#tilt
   * @fires OSMBuildings#change
   */
  setTilt: function(tilt) {
    tilt = clamp(parseFloat(tilt), 0, 45); // bigger max increases shadow moire on base map
    if (APP.tilt !== tilt) {
      APP.tilt = tilt;

      /**
       * Fired when the map is tilted
       * @event OSMBuildings#tilt
       */
      APP.emit('tilt', { tilt: tilt });
      APP.emit('change');
    }
    return APP;
  },

  /**
   * Returns the map's current tilt
   */
  getTilt: function() {
    return APP.tilt;
  },

  /**
   * Adds a layer to the map
   * @param {Object} layer - The layer to add
   */
  addLayer: function(layer) {
    APP.layers.push(layer);
    APP.updateAttribution();
    return APP;
  },

  /**
   * Removes a layer from the map
   * @param {Object} layer - The layer to remove
   */
  removeLayer: function(layer) {
    APP.layers = APP.layers.filter(function(item) {
      return (item !== layer);
    });
    APP.updateAttribution();
  },

  /**
   * Destroys the map
   */
  destroy: function() {
    render.destroy();

    // APP.basemapGrid.destroy();
    // APP.dataGrid.destroy();
    for (var i = 0; i < APP.layers.length; i++) {
      APP.layers[i].destroy();
    }

    APP.layers = [];

    // TODO: when taking over an existing canvas, better don't destroy it here
    GLX.destroy();

    APP.container.innerHTML = '';
  }
};

//*****************************************************************************

if (typeof define === 'function') {
  define([], OSMBuildings);
} else if (typeof module === 'object') {
  module.exports = OSMBuildings;
} else {
  window.OSMBuildings = OSMBuildings;
}
