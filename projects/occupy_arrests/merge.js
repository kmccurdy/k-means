var local = false;
var statesJSON = local ? "us-states.json" : "http://www.k-means.net/uploads/6/9/2/3/6923199/us-states.json"; //"https://raw.github.com/kmccurdy/k-means/scripts/projects/occupy_arrests/us-states.json";
var arrestsCSV = local ? "occupyarrests.csv" : "http://www.k-means.net/uploads/6/9/2/3/6923199/occupyarrests.csv"; //"https://raw.github.com/kmccurdy/k-means/scripts/projects/occupy_arrests/occupyarrests.csv";


// The radius scale for the centroids.
var r = d3.scale.sqrt()
    .domain([0, 700])
    .range([0, 40]);

// Our projection.
var xy = d3.geo.albersUsa();
var visScale = .8;
xy.scale(xy.scale() * visScale);
xy.translate([xy.translate()[0] * visScale, xy.translate()[1] * visScale]);

var svgW = 960 * visScale, svgH = 500 * visScale, svgM = 40 * visScale, svgP = 20 * visScale;

var svg = d3.select("#map").append("svg")
    .attr("width", svgW)
    .attr("height", svgH);
svg.append("g").attr("id", "states");
svg.append("g").attr("id", "arrest-locations");


d3.json(statesJSON, function(collection) {
  svg.select("#states")
    .selectAll("path")
      .data(collection.features)
    .enter().append("path")
	.attr("d", d3.geo.path().projection(xy));

});

// time formatting
var format = d3.time.format("%m/%d/%Y");
var occupyStart = format.parse("09/17/2011");
var currentDate = new Date();

var pause = false, pausepoint, currentView = "T";

// graph setup
var vis = d3.select("#graph")
  .append("svg")
    .attr("width", svgW + svgP * 2)
    .attr("height", svgH/5 + svgP * 2)
  .append("g")
	.attr("transform", "translate(" + svgM + "," + svgP + ")");


d3.csv(arrestsCSV, function(csv){

///////////////////////////////
// map
///////////////////////////////

  svg.select("#arrest-locations")
    .selectAll("circle")
	.data(csv.reverse())
    .enter().append("svg:a")
	.attr("xlink:href", function(d) { return d.source; })
	.attr("xlink:title", function(d) { return d.loc + ", " + d.date + ": " + d.count; })
      .append("circle")
	.attr("transform", function(d) { return "translate(" + xy([d.Long,d.Lat]) + ")"; })
	.attr("class", function(d) { return d.date; })
	.attr("r", 0);


///////////////////////////////
// line graph
///////////////////////////////

    var totalCounts = d3.nest()
	.key(function(d) {return d.date; })
	.rollup(function(ds) {return d3.sum(ds, function(d) { return d.count; })})
	.entries(csv);

    var cumCounts = d3.nest() 
	.key(function(d) {return d.date; })  
	.rollup(function(ds) {return d3.sum(ds, function(d) { return d.count; })})
	.entries(csv);

    for (var i = 1; i < totalCounts.length; i++) {
	cumCounts[i].values = cumCounts[i-1].values + totalCounts[i].values;
    }

    var w = svgW - svgM, h = svgH/5, p = svgP;
    var maxval = d3.max(totalCounts, function(d) {return d.values; }) + p;
    var x = d3.time.scale().domain([ occupyStart, currentDate ]).range([0, w]);
    var y = d3.scale.linear().domain([0, maxval]).range([h, 0]);

    vis.data([totalCounts]);

    var rules = vis.selectAll("g.rule")
	.data(x.ticks(8))
      .enter().append("g")
	.attr("class", "rule");

    // Draw grid lines
    rules.append("line")  
	.attr("x1", x)
	.attr("x2", x)
	.attr("y1", 0)
	.attr("y2", h - 1);

    rules.append("line")
	.attr("class", function(d) { return d ? null : "axis"; })
	.attr("id", "yAxis")
      .data(y.ticks(4))
	.attr("y1", y)
	.attr("y2", y)
	.attr("x1", 0)
	.attr("x2", w + 1);

    // Place axis tick labels
    rules.append("text")
	.attr("x", x)
	.attr("y", h + 3)
	.attr("dy", ".71em")
	.attr("text-anchor", "middle")
	.text(x.tickFormat(6));

    rules.append("text")
	.attr("id", "yAxis")
      .data(y.ticks(4))
	.attr("y", y)
	.attr("x", -3)
	.attr("dy", ".35em")
	.attr("text-anchor", "end")
	.text(y.tickFormat(4));

    
    // Draw static line of total count data
    vis.append("path")
	.attr("class", "line")
	.attr("d", d3.svg.line()  
	      .x(function(d) { return x(format.parse(d.key)); })
	      .y(function(d) { return y(d.values); }));

    // add timer line
    vis.append("line")
	.attr("x1", 0)
	.attr("x2", 0)
	.attr("y1", 0)
	.attr("y2", h-1)
	.attr("class", "timeline");

    //// play button - initial state set to totalCounts data
    //// hide button + view change form while animation plays

    d3.select("#run").on("click", function () { return play(totalCounts, currentView); });

    function play(data, view) {
	svg.select("#arrest-locations").selectAll("circle").attr("r", 0);
	vis.selectAll("circle.line").remove();
	d3.selectAll("form#view input").property("disabled","disabled");
	d3.select("button#run").text("Pause").on("click",function(){
	    return pause_play(data, view);});
	line_sweep(data, 0, view);
    }

    /////////////////////////////////////// SWITCH BETWEEN DATA VIEWS
    // circles initally invisible, default to all visible on data view switch

    d3.select("input[id=view-daily]").on("change", function() { 
	currentView = "T";
	svg.select("#arrest-locations").selectAll("circle").attr("r", function(d) { return r(d.count); });
	vis.selectAll("line.timeline").style("stroke","none");
	view_switch(totalCounts);
	vis.selectAll("circle.line").on("click", timeData); 
	d3.select("#run").on("click", function () { return play(totalCounts, currentView); });
    });
    d3.select("input[id=view-cum]").on("change", function() {
	currentView = "C";
	svg.select("#arrest-locations").selectAll("circle").attr("r", function(d) { return r(d.count); });
	vis.selectAll("line.timeline").style("stroke","none");
	view_switch(cumCounts);
	vis.selectAll("circle.line").on("click", cumulData);
	d3.select("#run").on("click", function () { return play(cumCounts, currentView); });
    });

    function view_switch(newData) {

	maxval = d3.max(newData, function(d) {return d.values; }) + p; // update variables
	y = d3.scale.linear().domain([0, maxval]).range([h, 0]);

	vis.data([newData]); // put in the new data

	vis.selectAll("line#yAxis") // update+redraw the y axis lines
	  .data(y.ticks(4))
	    .exit().remove();
	vis.selectAll("line#yAxis")
	  .data(y.ticks(4))
	    .attr("y1", y)
	    .attr("y2", y);
	vis.select("g.rule").selectAll("line#yAxis") // select one g.rule to append new line to
	  .data(y.ticks(4))
	   .enter().append("line")
	    .attr("class", function(d) { return d ? null : "axis"; })
	    .attr("id", "yAxis")
	    .attr("y1", y)
	    .attr("y2", y)
	    .attr("x1", 0)
	    .attr("x2", w + 1);

	vis.selectAll("text#yAxis") // update+redraw the y axis labels
	  .data(y.ticks(4))
	    .exit().attr("fill","none");
	vis.selectAll("text#yAxis") 
	  .data(y.ticks(4))
	    .attr("y", y)
	    .attr("fill","black")
	    .text(y.tickFormat(4));

	vis.selectAll("path.line") // update+redraw static line graph
	  .data([newData])
	    .attr("d", d3.svg.line()  
		  .x(function(d) { return x(format.parse(d.key)); })
		  .y(function(d) { return y(d.values); }));

	vis.selectAll("circle.line").remove(); // remove circles, fill in anew
	vis.selectAll("circle.line")
	    .data(newData)
	  .enter().append("svg:circle")
	    .attr("class", "line")
	    .attr("id", function(d) { return d.key; })
	    .attr("cx", function(d) { return x(format.parse(d.key)); })
	    .attr("cy", function(d) { return y(d.values); })
	    .attr("r", 2)
	   .style("stroke", "steelblue")
	    .on("mouseover", function() { d3.select(this).style("stroke", "#EE6363") })
	    .on("mouseout", function() { d3.select(this).style("stroke", "steelblue") })
	    .append("title")
	    .text(function(d) { return d.key + ": " + d.values; });

    };


    // data reveal functions

    function line_sweep(dateData, i, view) {

	if (i == (dateData.length - 1)) { show_all(dateData);
	} else {
				 
	    var d0 = format.parse(dateData[i].key),
	    d1 = format.parse(dateData[i+1].key),				
	    dur = (d1.getTime() - d0.getTime())/500000;

    vis.select("line.timeline")
	.attr("transform", "translate(" + x(d0) + ")")
	.style("stroke", "#EE6363")
      .transition()
	.ease("linear")
	.duration(dur)
	.attr("transform", "translate(" + x(d1) + ")")
	  .each("end", line_next(dateData, i, view));
				  
	};

	svg.select("#arrest-locations").selectAll("[class=\"" + dateData[i].key + "\"]")
	     .transition()
		.duration(150)
	        .attr("r", function(d) { return r(d.count); });
 
	if (view=="T"){
	    svg.select("#arrest-locations").selectAll("circle").filter(function(d){return d.date!=dateData[i].key; })
	      .transition()
		.duration(1000)
	        .attr("r", 0);
	};

    }


    function line_next(dateData, i, view){
	if (pause) { pausepoint = i; return; }
	i++;
	draw_circles(dateData.slice(0,i));
	while (i < dateData.length){
	    return function() {
		line_sweep(dateData, i, view);
	    }
	}
    }

    function draw_circles(dateData, all) {

	all = (typeof(all) == "undefined") ? false : true ;

	vis.selectAll("circle.line").style("stroke", "steelblue"); // pre-existing circles become blue                    
        var Circles = all ? 
	    vis.selectAll("circle.line")
	    .data(dateData)
	    .enter().append("circle") :
	    vis.append("circle")
	    .data(dateData.slice(dateData.length-1,dateData.length)) // last circle is red
	    .style("stroke", "#EE6363");

	    Circles.attr("class", "line")
	        .attr("id", function(d) { return d.key; })
	    .attr("cx", function(d) { return x(format.parse(d.key)); })
		.attr("cy", function(d) { return y(d.values); })	    
		.attr("r", 2)
		.on("mouseover", function() { d3.select(this).style("stroke", "#EE6363") })
		.on("mouseout", function() { d3.select(this).style("stroke", "steelblue") })
		.append("title")
		.text(function(d) { return d.key + ": " + d.values; });
    }  

    function pause_play(data, view) {
	pause = true;
	vis.selectAll("circle.line").on("click", currentView=="C" ? 
					cumulData : timeData);
	d3.select("button#stop-play").style("visibility","")
	    .on("click",function(){
		pause = false;
		d3.select("button#stop-play").style("visibility","hidden");
		show_all(data);
	    });
	d3.select("button#run").text("Resume")
	    .on("click",function(){
		pause = false;
		d3.select("button#stop-play").style("visibility","hidden");
		vis.selectAll("circle.line").on("click", "");
		line_sweep(data, pausepoint, view);
		d3.select("button#run").text("Pause").on("click",function(){
		    return pause_play(data, view);});
	    });
    }

    function show_all(dateData) {
	draw_circles(dateData, true);
	vis.selectAll("line.timeline").style("stroke","none");
	d3.selectAll("form#view input").property("disabled","");
	d3.select("#run").text("Play").on("click",function(){
	    return play(currentView == "C" ? cumCounts : totalCounts, currentView) ; })
	vis.selectAll("circle.line").style("stroke", "steelblue")
	    .on("click", currentView == "C" ? cumulData : timeData);
	svg.selectAll("#arrest-locations circle")
	    .attr("r", currentView=="T" ? 0 :
		  function(d) { return r(d.count); });
	
    }

///////////////////////////////
// interactive data selection
///////////////////////////////

    function timeData() {
	var m = d3.select(this);

	vis.select("line.timeline")
	    .attr("transform", "translate(" + m.attr("cx") + ")")
	    .style("stroke", "#EE6363");

	var day = m.attr("id");

	    svg.select("#arrest-locations").selectAll("circle")
		.attr("r", 0);
	    svg.select("#arrest-locations").selectAll("[class=\"" + day + "\"]")
		.attr("r", function(d) { return r(d.count); });
    };

    function cumulData() {
	var m = d3.select(this);

	vis.select("line.timeline")
	    .attr("transform", "translate(" + m.attr("cx") + ")")
	    .style("stroke", "#EE6363");

	var day = m.attr("id");

	    svg.select("#arrest-locations").selectAll("circle")
		.attr("r", function(d) { return r(d.count); });

	    var i = csv.length-1;
	    while (csv[i].date != day) {
		svg.select("#arrest-locations").selectAll("[class=\"" + csv[i].date + "\"]")
		    .attr("r", 0);
		i--;
	    } 
    };

});