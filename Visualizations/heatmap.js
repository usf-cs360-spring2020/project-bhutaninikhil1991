var margin = {
  top: 50,
  right: 0,
  bottom: 50,
  left: 40
};

var svgwidth = 600,
  svgheight = 400;
// calculate width and height based on window size
var heatmapwidth = svgwidth - margin.left - margin.right,
  gridSize = Math.floor(heatmapwidth / 24),
  heatmapheight = svgheight - margin.top - margin.bottom,
  buckets = 9,
  legendElementWidth = gridSize * 2,
  colors = ["#f7fcf0", "#e0f3db", "#ccebc5", "#a8ddb5", "#7bccc4", "#4eb3d3", "#2b8cbe", "#0868ac", "#084081"],
  days = ["Mon", "Tue", "Wed", "Thur", "Fri", "Sat", "Sun"],
  times = ["00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23"];

function formatDataHeatMap(data) {
  //grouping and sorting of data
  let dataGroup = d3.nest()
    .key(function(d) {
      return d.police_district;
    })
    .key(function(d) {
      return formatTimeDay(new Date(d.incident_datetime));
    }).sortKeys(d3.ascending)
    .key(function(d) {
      return formatTimeHour(new Date(d.incident_datetime));
    }).sortKeys(d3.ascending)
    .key(function(d) {
      return parseInt(d.incident_number);
    })
    .rollup(function(v) {
      return v.length;
    })
    .entries(data);

  var out = []
  dataGroup.forEach(function(police_district) {
    police_district.values.forEach(function(days) {
      days.values.forEach(function(hours) {
        out.push({
          location: police_district.key,
          day: parseInt(days.key),
          hour: parseInt(hours.key),
          value: hours.values.length
        });
      });
    });
  });
  dataGroup = out;

  return dataGroup;
}

function formatDataHeatMapForALL(data) {
  //grouping and sorting of data
  let dataGroup = d3.nest()
    .key(function(d) {
      return formatTimeDay(new Date(d.incident_datetime));
    }).sortKeys(d3.ascending)
    .key(function(d) {
      return formatTimeHour(new Date(d.incident_datetime));
    }).sortKeys(d3.ascending)
    .key(function(d) {
      return parseInt(d.incident_number);
    })
    .rollup(function(v) {
      return v.length;
    })
    .entries(data);

  var out = []
  dataGroup.forEach(function(days) {
    days.values.forEach(function(hours) {
      out.push({
        location: "all",
        day: parseInt(days.key),
        hour: parseInt(hours.key),
        value: hours.values.length
      });
    });
  });
  dataGroup = out;

  return dataGroup;
}

// svg container
var heatmapsvg = d3.select("svg#heatmap")
  .attr("width", svgwidth)
  .attr("height", svgheight)
  .append("g")
  .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

var dayLabels = heatmapsvg.selectAll(".dayLabel")
  .data(days)
  .enter()
  .append("text")
  .text(function(d) {
    return d;
  })
  .attr("x", 0)
  .attr("y", function(d, i) {
    return i * gridSize;
  })
  .style("text-anchor", "end")
  .attr("transform", "translate(-6," + gridSize / 1.5 + ")");

var timeLabels = heatmapsvg.selectAll(".timeLabel")
  .data(times)
  .enter()
  .append("text")
  .text(function(d) {
    return d;
  })
  .attr("x", function(d, i) {
    return i * gridSize;
  })
  .attr("y", 0)
  .style("text-anchor", "middle")
  .attr("transform", "translate(" + gridSize / 2 + ", -6)");

// create a tooltip
var tooltip = d3.select("#div_heatmap")
  .append("div")
  .style("opacity", 0)
  .attr("class", "tooltip")
  .style("background-color", "white")
  .style("border", "solid")
  .style("border-width", "2px")
  .style("border-radius", "5px")
  .style("padding", "5px")

function updateHeatMap(location, data, year) {
  if (location === "all")
    data = formatDataHeatMapForALL(data);
  else
    data = formatDataHeatMap(data);

  // group data by location
  var nest = d3.nest()
    .key(function(d) {
      return d.location;
    })
    .entries(data);

  // filter data to return object of location of interest
  var selectLocation = nest.find(function(d) {
    return d.key == location;
  });

  var colorScale = d3.scaleQuantile()
    .domain([0, (d3.max(data, function(d) {
      return d.value;
    }) / 2), d3.max(data, function(d) {
      return d.value;
    })])
    .range(colors);


  //remove existing data
  heatmapsvg.selectAll(".hour").remove();

  // Three function that change the tooltip when user hover / move / leave a cell
  var mouseover = function(d) {
    tooltip.style("opacity", 1)
  }
  var mousemove = function(d) {
    var coords = [d3.event.clientX, d3.event.clientY];
    var top = coords[1] - d3.select("#d3implementation").node().getBoundingClientRect().y + 20,
      left = coords[0] - d3.select("#d3implementation").node().getBoundingClientRect().x + 10;
    var html = `
      <table border="0" cellspacing="0" cellpadding="2">
      <tbody>
        <tr>
          <th>Police District:</th>
          <td class="text">${location}</td>
        </tr>
        <tr>
          <th>Missing Person Count in ${year}:</th>
          <td class="text">${d.value}</td>
        </tr>
      </tbody>
      </table>
    `;
    tooltip
      .html(html)
      .style("left", left + "px")
      .style("top", top + "px")
  }
  var mouseleave = function(d) {
    tooltip.style("opacity", 0)
  }

  var heatMap = heatmapsvg.selectAll(".hour")
    .data(selectLocation.values)
    .enter().append("rect")
    .attr("x", function(d) {
      return (d.hour) * gridSize;
    })
    .attr("y", function(d) {
      return (d.day - 1) * gridSize;
    })
    .attr("rx", 4)
    .attr("ry", 4)
    .attr("class", "hour bordered")
    .attr("width", gridSize)
    .attr("height", gridSize)
    .style("fill", colors[0]);

  heatMap.transition().duration(1000)
    .style("fill", function(d) {
      return colorScale(d.value);
    });

  d3.select("#heatmap").selectAll("rect")
    .on("mouseover", mouseover)
    .on("mousemove", mousemove)
    .on("mouseout", mouseleave);

  //to reset heap map legend
  d3.selectAll("#heatmaplegend").remove();

  var heatmaplegend = heatmapsvg.selectAll(".legend")
    .data([0].concat(colorScale.quantiles()), (d) => d);

  var legend_g = heatmaplegend.enter().append("g")
    .attr("class", "legend")
    .attr("id", "heatmaplegend");

  legend_g.append("rect")
    .attr("x", (d, i) => legendElementWidth * i)
    .attr("y", heatmapheight / 2 + 60)
    .attr("width", legendElementWidth)
    .attr("height", gridSize / 2)
    .style("fill", (d, i) => colors[i]);

  legend_g.append("text")
    .attr("class", "mono")
    .text((d) => "≥ " + Math.round(d))
    .attr("x", (d, i) => legendElementWidth * i)
    .attr("y", heatmapheight / 2 + 90);

}
