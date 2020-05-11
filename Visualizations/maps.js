var dataset;

//Width and height of map
var width = 600;
var height = 500;

//slider code
var margin = {
    top: 10,
    right: 10,
    bottom: 10,
    left: 10
  },
  sliderwidth = width - margin.left - margin.right,
  sliderheight = height / 2 - margin.top - margin.bottom;


var parseTime = d3.timeParse("%Y"),
  startYear = parseTime("2015"),
  endYear = parseTime("2019");

var formatTimeHour = d3.timeFormat("%H"),
  formatTimeDay = d3.timeFormat("%u");

var svgSlider = d3.select("#slider")
  .append("svg")
  .attr("width", width + 10)
  .attr("height", height / 2);

var x = d3.scaleTime()
  .domain([startYear, endYear])
  .range([margin.left, sliderwidth])
  .clamp(true);

var slider = svgSlider.append("g")
  .attr("class", "slider")
  .attr("transform", "translate(" + margin.left + "," + sliderheight / 2 + ")");

slider.append("line")
  .attr("class", "track")
  .attr("x1", x.range()[0])
  .attr("x2", x.range()[1])
  .select(function() {
    return this.parentNode.appendChild(this.cloneNode(true));
  })
  .attr("class", "track-inset")
  .select(function() {
    return this.parentNode.appendChild(this.cloneNode(true));
  })
  .attr("class", "track-overlay")
  .call(d3.drag()
    .on("start.interrupt", function() {
      slider.interrupt();
    })
    .on("start drag", function() {
      update(x.invert(d3.event.x));
    }));

slider.insert("g")
  .attr("transform", "translate(0," + -50 + ")")
  .append("text")
  .text("Year")
  .attr("font-size", "16px");

slider.insert("g", ".track-overlay")
  .attr("class", "ticks")
  .attr("transform", "translate(0," + 18 + ")")
  .selectAll("text")
  .data(x.ticks(5))
  .enter()
  .append("text")
  .attr("x", x)
  .attr("y", 10)
  .attr("text-anchor", "middle")
  .text(function(d) {
    return d.getFullYear();
  });

var handle = slider.insert("circle", ".track-overlay")
  .attr("class", "handle")
  .attr("r", 9);

var label = slider.append("text")
  .attr("class", "label")
  .attr("text-anchor", "middle")
  .text(startYear.getFullYear().toString())
  .attr("transform", "translate(0," + (-25) + ")")

//slider end

var urls = {
  basemap: "https://data.sfgov.org/resource/q52f-skbd.geojson",
  cases: "https://data.sfgov.org/resource/wg3w-h783.json"
};

//load data

// add parameters to url
urls.cases += "?$limit=8000&$where=starts_with(incident_category, 'Missing Person')";
urls.cases += " AND (report_type_code='II' OR report_type_code ='IS')";

var end = d3.timeDay(new Date(2017, 11, 31));
var start = d3.timeDay(new Date(2014, 12, 1));
var format = d3.timeFormat("%Y-%m-%dT%H:%M:%S");
//console.log(format(start), format(end));

var file = "https://data.sfgov.org/resource/tmnf-yvry.json"
file += "?$limit=15000&$where=starts_with(category, 'MISSING PERSON')";
file += " AND date between '" + format(start) + "'";
file += " AND '" + format(end) + "'";


Promise.all([
  d3.json(file).then(convertRow),
  d3.json(urls.cases),
]).then(function(files) {
  dataset = merge(files[0], files[1]);
  update(startYear);
}).catch(function(err) {
  // handle error here
  console.log(err);
})

var lowColor = '#ffe5d8';
var highColor = '#e0631f';

var active = d3.select(null);

var svg = d3.select("svg#map")
  .attr("width", width)
  .attr("height", height);

var g = {
  basemap: svg.select("g#basemap"),
  outline: svg.select("g#outline"),
  cases: svg.select("g#cases"),
  tooltip: svg.select("g#tooltip"),
  details: svg.select("g#details")
};

var tip = g.tooltip.append("text").attr("id", "tooltip");
tip.attr("text-anchor", "end");
tip.attr("dx", -5);
tip.attr("dy", -5);
tip.style("visibility", "hidden");

var nodes = {};

// add details widget
var details = g.details.append("foreignObject")
  .attr("id", "details")
  .attr("width", width)
  .attr("height", height)
  .attr("x", 0)
  .attr("y", 0);

var body = details.append("xhtml:body")
  .style("text-align", "left")
  .style("background", "none")
  .html("<p>N/A</p>");

details.style("visibility", "hidden");

var div = d3.select("#div_map").append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

// setup projection
// https://github.com/d3/d3-geo#geoConicEqualArea
var projection = d3.geoConicEqualArea();
projection.parallels([37.692514, 37.840699]);
projection.rotate([122, 0]);

// setup path generator (note it is a GEO path, not a normal path)
var path = d3.geoPath().projection(projection);

function formatDataForMap(data) {
  //grouping and sorting of data
  let dataGroup = d3.nest()
    .key(function(d) {
      return d.police_district;
    })
    .key(function(d) {
      return parseInt(d.incident_number);
    })
    .rollup(function(v) {
      return v.length;
    })
    .entries(data);

  var out = [];
  dataGroup.forEach(function(police_district) {
    out.push({
      key: police_district.key,
      value: parseInt(police_district.values.length)
    });
  });
  dataGroup = out;

  return dataGroup;
}

// Load in my states data!
function drawMap(filtereddataset, year) {

  // update the heat map and bar chart with default value of TENDERLOIN police district
  updateHeatMap("all", filtereddataset, year);
  updateBarChart("all", filtereddataset, year);

  var data = formatDataForMap(filtereddataset);

  var dataArray = [];
  for (var d = 0; d < data.length; d++) {
    dataArray.push(parseFloat(parseInt(data[d].value) / parseInt(filtereddataset.length)) * 100);
  }
  var minVal = d3.min(dataArray)
  var maxVal = d3.max(dataArray)
  var ramp = d3.scaleLinear().domain([minVal, maxVal]).range([lowColor, highColor])

  // Load GeoJSON data and merge with states data
  d3.json(urls.basemap).then(function(json) {
    // makes sure to adjust projection to fit all of our regions
    projection.fitSize([width, height], json);

    // Loop through each state data value in the .csv file
    for (var i = 0; i < data.length; i++) {

      // Grab State Name
      var dataDistrict = data[i].key;

      // Grab data value
      var dataValue = parseInt(data[i].value);

      // Find the corresponding state inside the GeoJSON
      for (var j = 0; j < json.features.length; j++) {
        var jsonDistrict = toTitleCase(json.features[j].properties.district);
        if (dataDistrict == jsonDistrict) {
          // Copy the data value into the JSON
          json.features[j].properties.value = parseFloat(dataValue / parseInt(filtereddataset.length) * 100);
          json.features[j].properties.count = dataValue;

          // Stop looking through the JSON
          break;
        }
      }
    }

    d3.select("svg#map").selectAll("path").remove();

    var basemap = g.basemap.selectAll("path.land")
      .data(json.features)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("class", "land")
      .style("fill", function(d) {
        return ramp(d.properties.value)
      });

    var outline = g.outline.selectAll("path.neighborhood")
      .data(json.features)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("class", "neighborhood")
      .style("fill", function(d) {
        return ramp(d.properties.value)
      })
      .style("stroke", "black")
      .style("stroke-width", 0.5)
      .each(function(d) {
        // save selection in data for interactivity
        // saves search time finding the right outline later
        d.properties.outline = this;
      });

    // add highlight
    basemap.on("mouseover.highlight", function(d) {
        d3.select(d.properties.outline).raise();
        d3.select(d.properties.outline).classed("active", true);
      })
      .on("mouseout.highlight", function(d) {
        d3.select(d.properties.outline).classed("active", false);
      });

    // add tooltip
    basemap.on("mouseover.tooltip", function(d) {
        tip.text(d.properties.district);
        tip.style("visibility", "visible");
        showLabel(d, year);
      })
      .on("mousemove.tooltip", function(d) {
        var coords = d3.mouse(g.basemap.node());
        tip.attr("x", coords[0]);
        tip.attr("y", coords[1]);
        moveLabel();
      })
      .on("mouseout.tooltip", function(d) {
        tip.style("visibility", "hidden");
        hideLabel();
      });

    basemap.on("click", function(d) {
      clicked(d, filtereddataset, year);
    });

    // reset legend
    d3.selectAll("#maplegend").remove();

    // add a legend
    var legendwidth = 20,
      legendheight = 300;

    var legendsvg = d3.select("#div_map")
      .append("svg")
      .attr("width", legendwidth + 100)
      .attr("height", legendheight)
      .attr("id", "maplegend")
      .attr("class", "legend");

    var legend = legendsvg.append("defs")
      .append("svg:linearGradient")
      .attr("id", "gradient")
      .attr("x1", "100%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "100%")
      .attr("spreadMethod", "pad");

    legend.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", highColor)
      .attr("stop-opacity", 1);

    legend.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", lowColor)
      .attr("stop-opacity", 1);

    legendsvg.append("rect")
      .attr("width", legendwidth)
      .attr("height", legendheight)
      .style("fill", "url(#gradient)")
      .attr("transform", "translate(0,10)");

    var y = d3.scaleLinear()
      .range([legendheight, 0])
      .domain([0, maxVal]);

    var yAxis = d3.axisRight(y)
      .tickFormat(function(d) {
        return d + "%";
      }).tickSizeOuter(0);

    legendsvg.append("g")
      .attr("class", "y axis")
      .attr("transform", "translate(20,10)")
      .call(yAxis)
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 30)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("% Crime Rate(Missing person)")
      .style("fill", "black");
  });
}

function showLabel(d, year) {
  var coords = [d3.event.clientX, d3.event.clientY];
  var top = coords[1] - d3.select("#div_map").node().getBoundingClientRect().y,
    left = coords[0] - d3.select("#div_map").node().getBoundingClientRect().x;
  var formatDecimal = d3.format(",.2f");
  var html = `
  <table border="0" cellspacing="0" cellpadding="2">
  <tbody>
    <tr>
      <th>Police District:</th>
      <td class="text">${d.properties.district}</td>
    </tr>
    <tr>
      <th>Missing Person Count in ${year}:</th>
      <td class="text">${d.properties.count}</td>
    </tr>
    <tr>
      <th>Crime Rate(Missing Person) in ${year}:</th>
      <td class="text">${formatDecimal(d.properties.value) + "%"}</td>
    </tr>
  </tbody>
  </table>
`;
  div.transition()
    .duration(200)
    .style("opacity", 0.9);
  div.html(html)
    .style("top", top + "px")
    .style("left", left + "px")
    .style("z-index", 10);
}

function moveLabel() {
  var coords = [d3.event.clientX, d3.event.clientY];

  var top = coords[1] - d3.select("#d3implementation").node().getBoundingClientRect().y + 20,
    left = coords[0] - d3.select("#d3implementation").node().getBoundingClientRect().x + 10;

  div.style("top", top + "px")
    .style("left", left + "px");
}

function hideLabel() {
  div.transition()
    .duration(200)
    .style("opacity", 0);
}

function clicked(d, filtereddataset, year) {
  updateHeatMap(toTitleCase(d.properties.district), filtereddataset, year);
  updateBarChart(toTitleCase(d.properties.district), filtereddataset, year);

  d3.select("svg#map").call(d3.zoom().extent([
      [0, 0],
      [width, height]
    ])
    .scaleExtent([1, 8]).on("zoom", function() {
      var e = d3.event.transform,
        tx = Math.min(0, Math.max(e.x, width - width * e.k)),
        ty = Math.min(0, Math.max(e.y, height - height * e.k));
      d3.select("svg#map").selectAll("g").attr("transform", d3.event.transform)
    }));
}

function update(h) {
  // update position and text of label according to slider scale
  handle.attr("cx", x(h));
  label
    .attr("x", x(h))
    .text(h.getFullYear());

  var newData = dataset.filter(function(d) {
    return parseInt(d.incident_year) == h.getFullYear();
  })

  drawMap(newData, h.getFullYear());
}

function convertRow(data) {
  var keep = [];
  var format = d3.timeFormat("%Y-%m-%dT%H:%M:%S");
  data.forEach(function(d) {
    let out = {};
    var datetime = combineDateAndTime(d.date, d.time);
    out["incident_datetime"] = format(datetime);
    out["incident_date"] = d.date;
    out["incident_time"] = d.time;
    out["incident_year"] = datetime.getFullYear().toString();
    out["incident_day_of_week"] = d.dayofweek;
    out["incident_number"] = d.incidntnum;
    out["police_district"] = d.pddistrict;
    out["incident_description"] = toTitleCase(d.descript);
    out["latitude"] = d.y;
    out["longitude"] = d.x;
    out["resolution"] = d.resolution;
    out["incident_category"] = toTitleCase(d.category);
    keep.push(out);
  });
  return keep;
}

function combineDateAndTime(date, time) {
  var tempdate = date.split("-");
  var temptime = time.split(":");
  return new Date(tempdate[0], tempdate[1] - 1, tempdate[2].substring(0, 2), temptime[0], temptime[1], 0, 0);
};

function toTitleCase(str) {
  return str.replace(/\w\S*/g, function(txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

function merge(data1, data2) {

  var keep = [];
  data1.forEach(function(d) {
    let out = {};
    out["incident_datetime"] = d.incident_datetime;
    out["incident_date"] = d.incident_date;
    out["incident_time"] = d.incident_time;
    out["incident_year"] = d.incident_year;
    out["incident_day_of_week"] = d.incident_day_of_week;
    out["incident_number"] = d.incident_number;
    out["police_district"] = toTitleCase(d.police_district);
    out["incident_description"] = d.incident_description;
    out["latitude"] = d.latitude;
    out["longitude"] = d.longitude;
    out["resolution"] = d.resolution;
    out["incident_category"] = d.incident_category;
    keep.push(out);
  });

  data2.forEach(function(d) {
    let out = {};
    out["incident_datetime"] = d.incident_datetime;
    out["incident_date"] = d.incident_date;
    out["incident_time"] = d.incident_time;
    out["incident_year"] = d.incident_year;
    out["incident_day_of_week"] = d.incident_day_of_week;
    out["incident_number"] = d.incident_number;
    out["police_district"] = toTitleCase(d.police_district);
    out["incident_description"] = d.incident_description;
    out["latitude"] = d.latitude;
    out["longitude"] = d.longitude;
    out["resolution"] = d.resolution;
    out["incident_category"] = d.incident_category;
    keep.push(out);
  });

  return keep
}
