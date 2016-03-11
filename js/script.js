//name map layers
var pointLayer,ntaLayer,cdLayer,drawnLayer;
var selection = {};
selection.areaType='currentView';

//initialize map
var map = new L.Map('map', { 
  center: [40.70663644882689,-73.97815704345703],
  zoom: 14
});

L.tileLayer('http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',{
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
}).addTo(map);

var selectLayer = L.geoJson().addTo(map); //add empty geojson layer for selections

initLeafletDraw();

//add cartodb named map
var layerUrl = 'https://cwhong.cartodb.com/api/v2/viz/a1bdc326-73bb-11e5-927a-0ea31932ec1d/viz.json';

cartodb.createLayer(map, layerUrl)
  .addTo(map)
  .on('done', function(layer) {

    //points
    pointLayer = layer.getSubLayer(0);
    pointLayer.setInteraction(false);


    //neighborhood tabulation areas
    ntaLayer = layer.getSubLayer(1); 
    ntaLayer.setInteraction(true);
    ntaLayer.hide();  //hide neighborhood polygons
    ntaLayer.on('featureClick', function(e, latlng, pos, data, layer) {
      var cartodb_id = data.cartodb_id;
      processGeom('nynta',cartodb_id)
      updateCount();
    });

    //community districts
    cdLayer = layer.getSubLayer(2); 
    cdLayer.setInteraction(true);
    cdLayer.hide();  //hide neighborhood polygons
    cdLayer.on('featureClick', function(e, latlng, pos, data, layer) {
      var cartodb_id = data.cartodb_id;
      processGeom('nycd',cartodb_id)
      updateCount();
    });  
  });

var sql = new cartodb.SQL({ user: 'cwhong' });

//get max, min, count, populate date range slider
sql.execute("SELECT min(created_date),max(created_date),count(*) FROM three_one_one")
  .done(function(data) {
    var d = data.rows[0];

    var options = {
      count: d.count.toLocaleString(),
      start: moment(d.min).format('MM/DD/YYYY'),
      end: moment(d.max).format('MM/DD/YYYY')
    }

    var info = Mustache.render("Current Dataset contains {{count}} rows from {{{start}}} to {{{end}}}",options);
    
    $('.info').text(info);

    //set initial values for selected date (will be updated when user changes slider)
    selection.dateRange = {
      min: new Date(moment(d.max).subtract(90,'days')),
      max: new Date(d.max)
    }

    selection.dateRangeFormatted = {
      min:moment(selection.dateRange.min).format('YYYY-MM-DD'),
      max:moment(selection.dateRange.max).format('YYYY-MM-DD')
    }
      

    //Set initial slider range
    $("#slider").dateRangeSlider({
      bounds:{
        min: new Date(d.min),
        max: new Date(d.max)
      },
      defaultValues:{
        min: selection.dateRange.min,
        max: selection.dateRange.max
      }
    });   
  });

//update selection dateRange when user changes slider
$("#slider").bind("valuesChanged", function(e, data){  
  selection.dateRange = {
    min: data.values.min,
    max: data.values.max
  };

  selection.dateRangeFormatted = {
    min:moment(selection.dateRange.min).format('YYYY-MM-DD'),
    max:moment(selection.dateRange.max).format('YYYY-MM-DD')
  }

  updateCount();
  updateMap();
});

map.on('dragend', checkType);
map.on('zoomend', checkType);

function checkType() {
  if(selection.areaType=='currentView') {
    updateCount();
  }
}

//radio buttons
$('input[type=radio][name=area]').change(function() {
  console.log(cdLayer);
  //reset all the things
  ntaLayer.hide();
  cdLayer.hide();
  selectLayer.clearLayers();
  $('.leaflet-draw-toolbar').hide();
  if (drawnLayer) {
    map.removeLayer(drawnLayer);
  }

  //turn on certain things 
  if(this.value == 'polygon') {
    hideCount();
    selection.areaType='polygon';
    $('.leaflet-draw-toolbar').show();
    $('.download').attr('disabled','disabled');
  }
  if(this.value == 'currentView') {
    selection.areaType='currentView';
    updateCount();
  }
  if(this.value == 'neighborhood') {
    hideCount();
    selection.areaType='neighborhood';
    ntaLayer.show();
    $('.download').attr('disabled','disabled');
  }
  if(this.value == 'communityDistrict') {
    hideCount();
    selection.areaType='communityDistrict';
    cdLayer.show();
    $('.download').attr('disabled','disabled');
  }
})

//runs when any of the download buttons is clicked
$('.download').click(function(){
  selection.downloadType = $(this).attr('id');
  var query = buildQuery();
  var url = buildUrl(query);
  window.open(url, 'My Download');
});

//functions
function buildQuery(count) {

  //get current view, download type, and checked fields
  selection.bbox = map.getBounds();
 


  if(selection.areaType == 'currentView') {
    var bboxString = selection.bbox._southWest.lng + ',' 
    + selection.bbox._southWest.lat + ','
    + selection.bbox._northEast.lng + ','
    + selection.bbox._northEast.lat;

    selection.intersects = 'ST_MakeEnvelope(' + bboxString + ',4326)';
  }

  // if(selection.areaType == 'polygon') {
  //   selection.intersects = customPolygon;
  // }

  if(selection.areaType == 'neighborhood') {
    selection.intersects = nPolygon;
  }

  if(selection.areaType == 'communityDistrict') {
    selection.intersects = nPolygon;
  }
  
  if(selection.downloadType == 'cartodb') {
    selection.downloadType = 'geojson';
    selection.cartodb = true;
  }

  (count) ? selection.select = 'count(*)' : selection.select = '*';

  var sql = Mustache.render('SELECT {{select}} FROM three_one_one a WHERE ST_INTERSECTS({{{intersects}}}, a.the_geom) AND created_date >= \'{{dateRangeFormatted.min}}\' AND created_date <= \'{{dateRangeFormatted.max}}\'',selection);

  return sql;
}

function hideCount() {
  $('#count').fadeOut();
}

function updateMap() {
  console.log('updatemap');
  var mapQuery = Mustache.render('SELECT *,mod(cartodb_id,4) as cat FROM three_one_one WHERE created_date >= \'{{dateRangeFormatted.min}}\' AND created_date <= \'{{dateRangeFormatted.max}}\'',selection);
  console.log(mapQuery);

  pointLayer.setSQL(mapQuery);

}

function buildUrl(sql) {
  var url = Mustache.render('https://cwhong.cartodb.com/api/v2/sql?skipfields=cartodb_id,created_at,updated_at,name,description&format={{type}}&filename=311&q={{{sql}}}',{
    type: selection.downloadType,
    sql: sql
  });

  console.log("Downloading " + url);

  //http://oneclick.cartodb.com/?file={{YOUR FILE URL}}&provider={{PROVIDER NAME}}&logo={{YOUR LOGO URL}}
  if(selection.cartodb) {
    //open in cartodb only works if you encodeURIcomponent() on the SQL, 
    //then concatenate with the rest of the URL, then encodeURIcomponent() the whole thing

    //first, get the SQL
    var sql = url.split("q=");
    sql = encodeURIComponent(sql[1]);


    url = url.split("SELECT")[0];
    url += sql;

    url = encodeURIComponent(url);
    console.log(url);
    url = 'http://oneclick.cartodb.com/?file=' + url;
  } 
    
  return url;
}

function updateCount() {
  var query = buildQuery(true);
  sql.execute(query)
    .done(function(data) {
      var count = data.rows[0].count.toLocaleString();
      $('#count').text('The current selection contains ' + count + ' rows.').fadeIn();
      
    });
}

//when a polygon is clicked in Neighborhood View, download its geojson, etc
function processGeom(tableName,cartodb_id) {
  console.log('processGeom');

  selectLayer.clearLayers();

  var options = { 
    id: cartodb_id,
    tableName: tableName 
  }

  
  sql.execute("SELECT the_geom FROM {{tableName}} WHERE cartodb_id = {{id}}", 
    options,
    {
      format:'geoJSON'
    }
  )
  .done(function(data) {
    console.log(data);
    selectLayer.addData(data);
    //setup SQL statement for intersection
    nPolygon = Mustache.render("(SELECT the_geom FROM {{tableName}} WHERE cartodb_id = '{{id}}')",options);
  })
}

//turns an array of latLngs into an ST_POLYGONFROMTEXT
function makeSqlPolygon(coords) {
  var s = "ST_SETSRID(ST_PolygonFromText(\'POLYGON((";
  var firstCoord;
  coords.forEach(function(coord,i){
    console.log(coord);
    s+=coord.lng + " " + coord.lat + ","

    //remember the first coord
    if(i==0) {
      firstCoord = coord;
    }

    if(i==coords.length-1) {
      s+=firstCoord.lng + " " + firstCoord.lat;
    }
  });
  s+="))\'),4326)"
  console.log(s);
  return s;
}


function initLeafletDraw() {
  //leaflet draw stuff


var options = {
    position: 'topright',
    draw: {
        polyline:false,
        polygon: {
            allowIntersection: false, // Restricts shapes to simple polygons
            drawError: {
                color: '#e1e100', // Color the shape will turn when intersects
                message: '<strong>Oh snap!<strong> you can\'t draw that!' // Message that will show when intersect
            },
            shapeOptions: {
                color: '#bada55'
            }
        },
        circle: false, // Turns off this drawing tool
        rectangle: {
            shapeOptions: {
                clickable: false
            }
        },
        marker:false
    }
};



var drawControl = new L.Control.Draw(options);
  map.addControl(drawControl);
  $('.leaflet-draw-toolbar').hide();

 
  map.on('draw:created', function (e) {
      //hide the arrow
      $('.infoArrow').hide();

      var type = e.layerType,
          layer = e.layer;

      console.log(e.layer);
      drawnLayer=e.layer;

      var coords = e.layer._latlngs;
      console.log(coords);
      selection.intersects = makeSqlPolygon(coords);
      // Do whatever else you need to. (save to db, add to map etc)
      map.addLayer(layer);
      $('.download').removeAttr('disabled');
      updateCount();
  });

  map.on('draw:drawstart', function (e) {
    console.log('start');
    if (drawnLayer) {
      map.removeLayer(drawnLayer);
    }
  });

}

$( document ).ready(function() {
    $('.js-about').click(function() {

      $('#modal').fadeIn();
    });

    $('#modal').click(function() {
      $(this).fadeOut();
    });

    $('.modal-inner').click(function(event) {
      event.stopPropagation();
    });

    $(document).on('keyup',function(evt) {
        if (evt.keyCode == 27) {
          if ($('#modal').css('display')=='block') {
           $('#modal').fadeOut();
          }
        }
    });

    var scrollShadow = (function() {
    var elem, width, height, offset,
        shadowTop, shadowBottom,
        timeout;
    


    function initShadows() {
      shadowTop = $("<div>")
        .addClass("shadow-top")
        .insertAfter(elem);
      shadowBottom = $("<div>")
        .addClass("shadow-bottom")
        .insertAfter(elem)
        .css('display', 'block');
    }
    
    function calcPosition() {
      width = elem.outerWidth();
      height = elem.outerHeight();
      offset = elem.position();  

      // update 
      shadowTop.css({
        width: width + "px",
        top: offset.top + "px",
        left: offset.left + "px"
      });
      shadowBottom.css({
        width: width + "px",
        top: (offset.top + height-40) + "px",
        left: offset.left + "px"
      });
    }
    function addScrollListener() {
      elem.off("scroll.shadow");
      elem.on("scroll.shadow", function () {
        if (elem.scrollTop() > 0) {
          shadowTop.fadeIn(125);
        } else {
          shadowTop.fadeOut(125);
        }
        if (elem.scrollTop() + height >= elem[0].scrollHeight && elem.scrollTop()!==0 ) {
          shadowBottom.fadeOut(125);
        } else {
          shadowBottom.fadeIn(125);
        }
      });
    }
    function addResizeListener() {
      $(window).on("resize.shadow", function(){ 
        clearTimeout(timeout);
        timeout = setTimeout(function() {
          calcPosition();
          elem.trigger("scroll.shadow");
        }, 10);
      });
    }
    return {
      init: function(par) {
        elem = $(par);
        //initShadows();
        calcPosition();
        addScrollListener();
        addResizeListener();
        elem.trigger("scroll.shadow");
      },
      update: calcPosition
    };
    
  }());
  // start
  scrollShadow.init(".well-inner");
});