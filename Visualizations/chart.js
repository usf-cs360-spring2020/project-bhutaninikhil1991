var margin = {
    top: 50,
    right: 0,
    bottom: 50,
    left: 40
  },
  svgwidth = 600,
  svgheight = 400,
  barchartwidth = svgwidth - margin.left - margin.right,
  barchartheight = svgheight - margin.top - margin.bottom;

var months = ["January", "February", "March", "April", "May",
  "June", "July", "August", "September", "October", "November", "December"
];
var formatTimeMonth = d3.timeFormat("%B");

function formatChartData(data) {
  //grouping and sorting of data
  let dataGroup = d3.nest()
    .key(function(d) {
      return d.police_district;
    })
    .key(function(d) {
      return formatTimeMonth(new Date(d.incident_datetime));
    })
    .sortKeys(function(a, b) {
      return months.indexOf(a) - months.indexOf(b);
    })
    .key(function(d) {
      return parseInt(d.incident_number);
    })
    .rollup(function(v) {
      return v.length;
    })
    .entries(data)
    .map(function(group) {
      return {
        "location": group.key,
        "values": group.values.map(function(subgroup) {
          return {
            "month": subgroup.key,
            "value": subgroup.values.length
          }
        })
      }
    });

  return dataGroup;
}

// Create canvas
var barchart =
  d3.select("svg#barchart")
  .attr("width", svgwidth)
  .attr("height", svgheight)
  .append("g")
  .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// create a tooltip
var tooltip = d3.select("#div_barchart")
  .append("div")
  .style("opacity", 0)
  .attr("class", "tooltip")
  .style("background-color", "white")
  .style("border", "solid")
  .style("border-width", "2px")
  .style("border-radius", "5px")
  .style("padding", "5px");

function updateBarChart(location, data, year) {

  data = formatChartData(data);

  var newData = data.filter(function(d) {
    if (location === "all")
      return true;
    else
      return d.location === location;
  }).map(function(d) {
    return d.values.map(d => d.value);
  });

  var res = [];

  for (var i = 0; i < months.length; i++) {
    res[i] = 0;
    for (var j = 0; j < newData.length; j++) {
      res[i] += parseInt(newData[j][i]);
    }
  }

  data = (location === "all" ? res : newData[0]);

  let countMin = 0;
  let countMax = d3.max(data);

  if (isNaN(countMax)) {
    countMax = 0;
  }

  // reset x and y axis
  d3.select("svg#barchart").select("g.x-axis").remove();
  d3.select("svg#barchart").select("g.y-axis").remove();

  // Make x scale
  var xScale = d3.scaleBand()
    .domain(months)
    .range([0, barchartwidth])
    .padding(0.1);

  // Make y scale, the domain will be defined on bar update
  var yScale = d3.scaleLinear()
    .domain([countMin, countMax])
    .range([barchartheight, 0])
    .nice();

  // Make x-axis and add to canvas
  var xAxis = d3.axisBottom(xScale).tickSizeOuter(0);

  var xAxis = barchart.append("g")
    .attr("class", "x-axis")
    .attr("transform", "translate(0," + barchartheight + ")")
    .call(xAxis);

  xAxis.append("text")
    .attr("transform",
      "translate(" + (barchartwidth / 2) + " ," +
      margin.top + ")")
    .style("text-anchor", "middle")
    .style("fill", "black")
    .text("Month");

  // Make y-axis and add to canvas
  var yAxis = d3.axisLeft(yScale);

  var yAxisHandleForUpdate = barchart.append("g")
    .attr("class", "y-axis")
    .call(yAxis);

  yAxisHandleForUpdate.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - margin.left)
    .attr("x", 0 - (barchartheight / 2))
    .attr("dy", ".71em")
    .style("text-anchor", "middle")
    .style("fill", "black")
    .text("Incident Count");

  //make bars
  var bars = barchart.selectAll(".bar").data(data);

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
            <td class="text">${d}</td>
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

  bars.enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", function(d, i) {
      return xScale(months[i]);
    })
    .attr("width", xScale.bandwidth())
    .attr("y", function(d, i) {
      return yScale(d);
    })
    .attr("height", function(d, i) {
      return barchartheight - yScale(d);
    });

  d3.select("#barchart").selectAll("rect")
    .on("mouseover", mouseover)
    .on("mousemove", mousemove)
    .on("mouseout", mouseleave);

  // Update old ones, already have x / width from before
  bars
    .transition().duration(250)
    .attr("y", function(d, i) {
      return yScale(d);
    })
    .attr("height", function(d, i) {
      return barchartheight - yScale(d);
    });

  // Remove old ones
  bars.exit().remove();
};
