var local = false,
    source = local ? "2013.json" : "http://www.k-means.net/uploads/6/9/2/3/6923199/2013.json";

var sun = {}, moon = {}, month = {};

var w = 680,
    h = 680,
    outer_r1 = Math.min(w, h) / 2,
    arc_height = .04,
    padding = .025,
    n = 10,
    q = 0,
    div_angle = .3,
    range,
    mouseStartQ,
    Dtext,
    Ttext,
    Stext,
    todayLine = true,
    todayDegree,
    todayCol = d3.rgb("teal"),
    now = new Date(),
    arcDur = 4000,
    dayLineDur = arcDur,
    opacDur = 1500,
    day = d3.time.day,
    arc = d3.svg.arc(),
    donut = d3.layout.pie().sort(null),
    new_donut,
    old_donut1,
    old_donut2,
    utc = d3.time.format("%Y-%m-%d %H:%M:%S"),
    dateF = d3.time.format("%e %b %Y"),
    dateM = d3.time.format("%e %b"),
    dateT = d3.time.format("%H:%M"),
    dateZ = d3.time.format("%Z"),
    dateMname = d3.time.format("%B"),
    dateYname = d3.time.format("%Y");

sun.col1 = d3.rgb("cornsilk");
sun.col2 = d3.rgb("midnightblue");
moon.col1 = d3.rgb("aliceblue");
moon.col2 = d3.rgb("lightsteelblue");
month.r1 = outer_r1 * (1 - padding);
month.r0 = outer_r1 * (1 - padding - arc_height);
sun.r1 = outer_r1 * (1 - padding*2 - arc_height);
sun.r0 = outer_r1 * (1 - padding*2 - arc_height*2);
moon.r1 = outer_r1 * (1 - padding*3 - arc_height*2);
moon.r0 = outer_r1 * (1 - padding*3 - arc_height*3);
sun.arc = d3.svg.arc().innerRadius(sun.r0).outerRadius(sun.r1);
moon.arc = d3.svg.arc().innerRadius(moon.r0).outerRadius(moon.r1);
month.arc = d3.svg.arc().innerRadius(month.r0).outerRadius(month.r1);

var regex = {
    sun: RegExp('Sun'),
    moon: RegExp('Moon'),
    rise: RegExp('rise'),
    set: RegExp('set'),
    spl: RegExp('spl')
};

var x = d3.scale.linear().range([0, w]),
    y = d3.scale.linear().range([h, 0]),
    x_a = d3.scale.linear().range([-w/2,w/2]),
    y_a = d3.scale.linear().range([h/2,-h/2]),
    x_m = d3.scale.linear().domain([0,w]).range([-w/2,w/2]),
    y_m = d3.scale.linear().domain([h,0]).range([h/2,-h/2]);

var vis = d3.select("#body")
  .append("svg")
    .attr("width", w)
    .attr("height", h);

var timeLabel = d3.select("#body")
  .append("div")
    .attr("class", "timeLabel");
var dateLabel = d3.select("#body")
  .append("div")
    .attr("class", "dateLabel");
var stats = d3.select("#body")
  .append("div")
    .attr("class", "stats");
var rangeStats =stats.append("div").attr("class","rStats"),
   sunStats = stats.append("div").attr("class","sStats"),
   moonStats = stats.append("div").attr("class","mStats");

d3.json(source, function(json){

    var TZoffset = parseFloat(dateZ(utc.parse(json[0].utc)))/100; // get time zone offset, in hours

    setupData(sun, regex.sun);
    setupData(moon, regex.moon);

    var start = day.floor(d3.min(sun.dates.concat(moon.dates))), 
    end = day.ceil(d3.max(sun.dates.concat(moon.dates)));
    setDateRange(sun, regex.rise);
    setDateRange(moon, regex.rise);
    range = [start, end];
    month.dates = [start].concat(d3.time.months(start,end).concat([end]));
    if (+month.dates[0] - +month.dates[1] == 0) month.dates.shift();
    month.colors = d3.scale.ordinal().domain(month.dates.map(function(d){return d.getMonth();})).range(colorbrewer.OrRd[9].concat(colorbrewer.OrRd[3].reverse())),
    dateLabel.text(dateF(start)); timeLabel.text(" \u2015 " + dateF(end));

    setDataDonut(sun);
    setDataDonut(moon);
    setDataDonut(month);

    sun.meanAll = ms_to_hours_mean(sun.data.filter(function(d,i){ return sun.events[i]=="Sunrise"; })), 
    moon.meanAll = ms_to_hours_mean(moon.data.filter(function(d,i){ return moon.events[i]=="Moonrise"; }));
    rangeStats.text(dateF(start) + " \u2015 " + dateF(end));
    sunStats.text("Mean length of solar day: "+sun.meanAll+" hours"); 
    moonStats.text("Mean length of lunar day: "+moon.meanAll+" hours");

    classInit("sun", sun, function(d,i) { return alternatingFill(d,i,sun); }, 
	      function(d,i) { return dateText(d,i,sun,regex.sun) });

    classInit("moon", moon, function(d, i) { return alternatingFill(d,i,moon); }, 
	      function(d,i) { return dateText(d,i,moon,regex.moon); });

    classInit("month", month, function(d,i) { return month.colors(month.dates[i].getMonth()); }, 
	      function(d,i) {
		  Dtext = dateMname(month.dates[i]); Ttext = dateYname(month.dates[i]);
		  dateLabel.text(Dtext); timeLabel.text(Ttext);
	      });

    vis.selectAll("g.month path") // when click on month: zoom to that month
	.on("click", function(d){ 
	    var sA = d.startAngle, eA = d.endAngle;
	    vis.selectAll(".radLines line").classed("selected", function(d) {
		return sA <= d*0.01745 && d*0.01745 <= eA; });
	    vis.classed("selecting", true);
	    vis.selectAll("path").style("fill-opacity", ".5");
	    stats.selectAll("div").text("");
	    brushend();
	});

    todayDegree = Math.round(360*(now-range[0])/(range[1]-range[0])) + 270; // calculates where today would be on entire circle
    var textPos = d3.min([sun.r0, moon.r0, month.r0]);
    var today = vis.selectAll("g.today")
	.data([todayDegree]) 
    .enter().append("g")
	.attr("class","today")
	.attr("transform", function (d) {
	    return "translate(" + outer_r1 + "," + 
		outer_r1 + ") rotate(" + d + ")";
    });
    today.append("line")
	.attr("x2", textPos)
	.style("stroke",function() { return todayLine ? todayCol : "none"; })
	.style("stroke-opacity",.5);
    today.append("text")
	.attr("x", textPos)
	.attr("text-anchor","end")
	.style("fill-opacity",.5)
	.style("fill",todayCol.darker())
	.text("now");

    function setupData(obj, regexp){
	obj.origJ = json.filter(function(d){ return regexp.test(d.event); });
	obj.origJ.forEach(function(d){d.utcDate = d3.time.hour.offset(utc.parse(d.utc),TZoffset);});
	obj.J = obj.origJ.map(function(d) { return {date: d.utcDate, event: d.event}; });
	obj.dates = obj.J.map(function(d) {return d.date;});
	obj.events = obj.J.map(function(d) {return d.event;});
    }

    function setDateRange(obj, regexp){
	var startEvent = regexp.test(obj.J[0].event) ? "dark" : "light";
	obj.J.unshift({ date: start, event: startEvent });
	obj.dates.unshift(start);
	obj.dates.push(end);
	obj.events.unshift(startEvent);
    }

    function setDataDonut(obj){
	obj.data = ms_time_diffS(obj.dates);
	obj.donut = donut(obj.data);
    }

});

var rad = vis.selectAll("g.radLines")
    .data(d3.range(360))
   .enter().append("g")
    .attr("class","radLines")
    .attr("id", function(d) {return d;})
    .attr("transform", function (d) {
	var degree = d + 270;
	return "translate(" + outer_r1 + "," + 
	    outer_r1 + ") rotate(" + degree + ")";
    });

rad.append("line")
    .attr("x2", outer_r1)
    .style("stroke","gainsboro")
    .style("stroke-opacity",function(d){return d == 0 ? "1" : ".3";});

var brsh = d3.svg.brush().x(x).y(y)
    .on("brushstart", brushstart)
    .on("brush", brush)
    .on("brushend", brushend);

vis.append("g")
    .attr("class", "brush")
    .call(brsh);


function brushstart() {
    vis.classed("selecting", true);
    vis.selectAll("path").style("fill-opacity", ".5");
    stats.selectAll("div").text("");

    var m = d3.mouse(this),  Rx = x_m(m[0]), Ry = y_m(m[1]);
    if (Rx > 0 && Ry > 0) {
	mouseStartQ = 1;
    } else if (Rx < 0 && Ry > 0) {
	mouseStartQ = 2;
    } else if (Rx < 0 && Ry < 0) {
	mouseStartQ = 3;
    } else if (Rx > 0 && Ry < 0) {
	mouseStartQ = 4;
    };
}

function brush() {
    var e = d3.event.target.extent();
    var Rx = x_a(e[0][0]), Ry = y_a(e[0][1]), angle1, angle2, Q;

    if (Rx > 0 && Ry > 0) {
	if (mouseStartQ == 4) {
	    angle1 = radianConvert(x_a(e[0][0]), y_a(e[1][1]));
	} else { angle1 = radianConvert(x_a(e[1][0]), y_a(e[1][1])); };
	angle2 = radianConvert(Rx, Ry);
	Q = 1;
    } else if (Rx < 0 && Ry > 0) {
	angle1 = radianConvert(x_a(e[1][0]), y_a(e[0][1]));
	if (mouseStartQ == 3) { 
	    angle2 = radianConvert(x_a(e[1][0]), y_a(e[1][1]));
	} else {angle2 = radianConvert(x_a(e[0][0]), y_a(e[1][1])); };
	Q = 2;
    } else if (Rx < 0 && Ry < 0) {
	angle1 = radianConvert(Rx, Ry);
	if (mouseStartQ == 4) {
	    angle2 = radianConvert(x_a(e[1][0]), y_a(e[0][1]));
	} else { angle2 = radianConvert(x_a(e[1][0]), y_a(e[1][1])); };
	Q = 3;
    } else if (Rx > 0 && Ry < 0) {
	angle1 = radianConvert(x_a(e[0][0]), y_a(e[1][1]));
	angle2 = radianConvert(x_a(e[1][0]), y_a(e[0][1]));
	Q = 4;
    };

    vis.selectAll(".radLines line").classed("selected", function(d) {
	if (Q == 4) { 
	    return angle1 <= d*0.01745 + (3*Math.PI/2) && d*0.0174 + (3*Math.PI/2) <= angle2;
	} else if (Q == 1 && angle1 > (3*Math.PI/2)) {
	    return (angle1 <= d*0.01745 + (3*Math.PI/2) && d < 90) || (d*0.01745 - (Math.PI/2) <= angle2 && d > 89);
	} else if (Q == 3 && angle2 > (3*Math.PI/2)) {
	    if (mouseStartQ == 3) {
		return angle1 <= d*0.01745 - (Math.PI/2);
	    } else if (mouseStartQ == 4) {
		return d*0.0174 + (3*Math.PI/2) <= angle2;
	    };
	} else {
	    return angle1 <= d*0.01745 - (Math.PI/2) && d*0.0174 - (Math.PI/2) <= angle2;
	};
    });

    vis.selectAll("line.selected").style("stroke", "#f00");

    var new_range = vis.selectAll("g.radLines").selectAll("line.selected"), ds = [];
    new_range.forEach(function(d,i) { ds[i] = d.length > 0 ? i/360 : NaN ; } );
    new_range = d3.extent(ds);
    var new_start = new Date(((range[1] - range[0])*new_range[0]) + +range[0]),
    new_end = new Date(((range[1] - range[0])*new_range[1]) + +range[0]);

    if (d3.select(".brush .extent").attr("width") > 0 && d3.select(".brush .extent").attr("height") > 0){
	Dtext = dateM(new_start) + " " + dateT(new_start); Ttext =  " \u2015 " + dateM(new_end) + " " + dateT(new_end);
	d3.select(".dateLabel").text(Dtext);
	d3.select(".timeLabel").text(Ttext); };
}

function brushend() {

    var new_range = vis.selectAll("g.radLines").selectAll("line.selected"), ds = [];
    new_range.forEach(function(d,i) { ds[i] = d.length > 0 ? i/360 : NaN ; } );
    new_range = d3.extent(ds);
    if (isNaN(new_range[0])||isNaN(new_range[1])||new_range[1]-new_range[0]==0) {
	vis.selectAll(".radLines line").classed("selected", false).style("stroke","gainsboro");
	vis.selectAll("path").style("fill-opacity", "1");
	vis.classed("selecting", false);
	brsh.clear();
	vis.selectAll(".brush .extent").attr("width",0).attr("height",0);
	return;
    };
    var div_ang1 = div_angle * new_range[0],
    div_ang2 = 2*Math.PI - div_angle + div_ang1,
    new_start = new Date(((range[1] - range[0])*new_range[0]) + +range[0]),
    new_end = new Date(((range[1] - range[0])*new_range[1]) + +range[0]),
    new_donut = d3.layout.pie().sort(null).startAngle(div_ang1).endAngle(div_ang2), 
    old_donut1 = d3.layout.pie().sort(null).startAngle(0).endAngle(div_ang1),
    old_donut2 = d3.layout.pie().sort(null).startAngle(div_ang2).endAngle(2*Math.PI);

    newDataDonut(sun);
    newDataDonut(moon);
    newDataDonut(month);

    classZoomIn("sun", sun, 1, function(d,i){ return alternatingFill(d,i,sun); },
	function(d,i){ return zoomedInMouseover(d,i,sun); },
	function(d,i){ if(i < sun.spl1 || i > sun.spl2){zoom_out();}; }, 
	function(){ vis.selectAll(".sun path, .moon path, .month path").style("stroke","none"); });

    classZoomIn("moon", moon, 1, function(d,i){ return alternatingFill(d,i,moon); },
	function(d,i){ return zoomedInMouseover(d,i,moon); },
	function(d,i){ if(i < moon.spl1 || i >= moon.spl2){zoom_out();}; }, 
	function(){ vis.selectAll(".sun path, .moon path, .month path").style("stroke","none"); });

    classZoomIn("month", month, .8, function(d,i){ return month.colors(month.newDates[i].getMonth());},
	function(d,i){ return zoomedInMouseover(d,i,month); }, 
	function(d,i){ if(i < month.spl1 || i >= month.spl2){zoom_out();}}, 
	function(){ vis.selectAll(".sun path, .moon path, .month path").style("stroke","none"); });


    vis.selectAll(".radLines line").classed("selected", false).style("stroke","gainsboro");
    vis.classed("selecting", false);
    brsh.clear();
    vis.selectAll(".brush").style("pointer-events","none");
    vis.selectAll(".brush .extent").attr("width",0).attr("height",0);

    sun.mean = ms_to_hours_mean(sun.newData.slice(sun.spl1, sun.spl2-1).filter(function(d,i){
	return sun.events.slice(sun.spl1, sun.spl2-1)[i]=="Sunrise";})), 
    moon.mean = ms_to_hours_mean(moon.newData.slice(moon.spl1, moon.spl2-1).filter(function(d,i){
	return moon.events.slice(moon.spl1, moon.spl2-1)[i]=="Moonrise";}));
    Dtext = dateM(new_start) + " " + dateT(new_start) ; Ttext =  " \u2015 " + dateM(new_end) + " " + dateT(new_end);
    dateLabel.text(Dtext); timeLabel.text(Ttext);
    rangeStats.text(dateF(new_start) + " \u2015 " + dateF(new_end));
    sunStats.text(isNaN(sun.mean)?"Solar day average not calculable":"Mean length of solar day: "+sun.mean+" hours"); 
    moonStats.text(isNaN(moon.mean)?"Lunar day average not calculable":"Mean length of lunar day: "+moon.mean+" hours");

    var newTodayAngle;
    if (now < new_start){
	newTodayAngle = old_donut1(ms_time_diffS([range[0],now,new_start]))[0].endAngle/0.01745;
    } else if (now > new_end) {
	newTodayAngle = old_donut2(ms_time_diffS([new_end,now,range[1]]))[0].endAngle/0.01745;
    } else {
	newTodayAngle = new_donut(ms_time_diffS([new_start,now,new_end]))[0].endAngle/0.01745;
    };
//    var todayDegree = vis.selectAll("g.today").attr("transform").slice(26,29);
    vis.selectAll("g.today")
	.data([newTodayAngle])
     .transition()
	.ease("linear")
	.duration(dayLineDur)
      .attrTween("transform", function (d) {
	    var degree = Math.round(d) + 270;
	  return d3.interpolateString(
	      "translate(" + outer_r1 + "," + outer_r1 + ") rotate(" + todayDegree + ")",
	      "translate(" + outer_r1 + "," + outer_r1 + ") rotate(" + degree + ")"
	  );
      })
	.attr("fill-opacity",.4);

    function newDataDonut(obj) {
	obj.divAng1 = div_ang1;
	obj.divAng2 = div_ang2;
	obj.newStart = new_start;
	obj.newEnd = new_end;
	obj.arrays = split_time(obj.dates, new_start, new_end); 
	obj.spl1 = obj.arrays[0].length;
	obj.spl2 = obj.arrays[0].length + obj.arrays[1].length;
	obj.newDonut = old_donut1(obj.arrays[0])
	    .concat(new_donut(obj.arrays[1])
		    .concat(old_donut2(obj.arrays[2])));
	if (obj.spl1 < 2) obj.newDonut[0].endAngle = 0;

	obj.newData = obj.data.slice(0,obj.data.length)
	obj.newData.splice(obj.spl1-1,1,
			obj.arrays[0][obj.arrays[0].length-1],obj.arrays[1][0]);
	obj.newData.splice(obj.spl2 > obj.data.length ? obj.spl2-1 : obj.spl2,1,
			obj.arrays[1][obj.arrays[1].length-1],obj.arrays[2][0]);
	obj.dataMod = donut(obj.newData); 
	if (obj.hasOwnProperty("events")) {
	    obj.events.splice(obj.spl2-1,0,"spl2");
	    obj.events.splice(obj.spl1,0,"spl1");
	    obj.dataMod.forEach(function(d,i){ 
		d.newSel = obj.newDonut[i]; 
		d.event = obj.events[i]; 
	    });
	} else {
	    obj.newDates = obj.dates.slice(0,obj.dates.length);
	    obj.newDates.splice(obj.spl1,0,new_start);
	    obj.newDates.splice(obj.spl2,0,new_end);
	    obj.dataMod.forEach(function(d,i){ 
		d.newSel = obj.newDonut[i]; 
//		d.event = obj.events[i]; 
	    });
	}
    }

    function zoomedInMouseover(d,i,obj){
	if (i < obj.spl1 || i >= obj.spl2) {
	    Dtext = dateF(obj.dates[0]); 
	    Ttext = " \u2015 " + dateF(obj.dates[obj.dates.length-1]);
	    vis.selectAll(".sun path").style("stroke",function(d,i){
		return i<sun.spl1 || i>sun.spl2 ? "floralwhite" : "none";
	    });
	    vis.selectAll(".moon path").style("stroke",function(d,i){
		return i<moon.spl1 || i>moon.spl2 ? "floralwhite" : "none";
	    });
	    vis.selectAll(".month path").style("stroke",function(d,i){
		return i<month.spl1 || i>month.spl2 ? "floralwhite" : "none";
	    });
	} else if (obj.hasOwnProperty("events")) {
	    if (i == obj.spl1) {
		Dtext = dateM(obj.newStart) + " " + dateT(obj.newStart); 
		Ttext =  " \u2015 " + dateM(obj.newEnd) + " " + dateT(obj.newEnd);
	    } else {
		Dtext = dateF(obj.dates[i-1]) + ": "; 
		Ttext = d.event + " at " + dateT(obj.dates[i-1]);
	    }
	} else {
	    Dtext = dateMname(obj.newDates[i]); 
	    Ttext = dateYname(obj.newDates[i]);
	}
	dateLabel.text(Dtext); timeLabel.text(Ttext);
    }
    
}

// returns to original data view
function zoom_out() {

    restoreData(sun);
    restoreData(moon);
    restoreData(month);

    classZoomOut("sun", sun, 1, function(d, i) { return alternatingFill(d,i,sun); },
		 function(d,i) { return dateText(d,i,sun,regex.sun); });

    classZoomOut("moon", moon, 1,  function(d, i) { return alternatingFill(d,i,moon); },
		 function(d,i) { return dateText(d,i,moon,regex.moon); });

    classZoomOut("month", month, .8, function(d, i) { return month.colors(month.dates[i].getMonth()); }, 
	function(d,i) {
	    Dtext = dateMname(month.dates[i]); Ttext = dateYname(month.dates[i]);
	    dateLabel.text(Dtext); timeLabel.text(Ttext); });

    vis.selectAll("g.month path") // when click on month: zoom to that month
	.on("click", function(d){ 
	    var sA = d.startAngle, eA = d.endAngle;
	    vis.selectAll(".radLines line").classed("selected", function(d) {
		return sA <= d*0.01745 && d*0.01745 <= eA; });
	    vis.classed("selecting", true);
	    vis.selectAll("path").style("fill-opacity", ".5");
	    stats.selectAll("div").text("");
	    brushend();
	});

    var todayPos = vis.selectAll("g.today").attr("transform").slice(26,29);
    vis.selectAll("g.today")
	.data([todayDegree])
     .transition()
	.ease("linear")
	.duration(dayLineDur)
      .attrTween("transform", function (d) {
//	    var degree = Math.round(d*360) + 270;
	  return d3.interpolateString(
	      "translate(" + outer_r1 + "," + outer_r1 + ") rotate(" + todayPos + ")",
	      "translate(" + outer_r1 + "," + outer_r1 + ") rotate(" + d + ")");
      })
	.style("fill-opacity",.3);

    brsh.clear();
    vis.selectAll(".brush").style("pointer-events","all");
//    stats.selectAll("div").text("");
    statsText();

    function restoreData(obj) {
	if (obj.hasOwnProperty("events")) {
	    obj.events = obj.events.filter(function(d,i){
		return !regex.spl.test(d); });
	}
	obj.dataMod = obj.dataMod.filter(function(d,i){
	    return i!=obj.spl1 && i!=obj.spl2; });
	obj.dataMod.forEach(function(d,i){ return d.newSel = obj.donut[i]; });
    }

}

// sets up initial classes + arc circles for vis
function classInit(className, object, fillFnc, mouseoverFnc){

    vis.selectAll("g."+className)
	.data(object.donut)
     .enter().append("g")
	.attr("class", className)
	.attr("transform", "translate(" + outer_r1 + "," + outer_r1 + ")")
     .append("path")
	.attr("fill", fillFnc)
	.attr("d", object.arc)	
	.on("mouseover", mouseoverFnc); 
}

// zooms in for particular class; assumes modData with newSel architecture suitable for tweenArc fnc
function classZoomIn(className, obj, endFillOpacity, fillFnc, mouseoverFnc, clickFnc, mouseoutFnc){

    vis.selectAll("g."+className)
	.data(obj.newDonut)
     .enter().append("g")
	.attr("class",className)
	.attr("transform", "translate(" + outer_r1 + "," + outer_r1 + ")")
     .append("path");
    vis.selectAll("." + className + " path")
	.data(obj.dataMod)
	.style("fill-opacity", ".5")
	.attr("d", obj.arc)
	.attr("fill", fillFnc) 
	.on("mouseover", mouseoverFnc)
	.on("click",clickFnc)
	.on("mouseout", mouseoutFnc)
	.each(function(d){
	    d3.select(this)
		.transition().duration(arcDur)
		.attrTween("d", tweenArc({
		    startAngle: d.newSel.startAngle,
		    endAngle: d.newSel.endAngle
		}, obj.arc))
		.each("end", function(d) {
		    d3.select(this)
			.transition().duration(opacDur)
			.style("fill-opacity",function(d){
			    return obj.divAng1<=d.startAngle && 
				d.endAngle<=obj.divAng2 +.0000001 ? 
				endFillOpacity :".5";});
		});
	});
}

// zooms out each class
function classZoomOut(className, obj, endFillOpacity, fillFnc, mouseoverFnc){
    vis.selectAll("g." + className)
	.data(obj.data)
     .exit().remove();
    vis.selectAll("." + className + " path")
	.data(obj.dataMod)
	.style("fill-opacity", ".5")
	.attr("fill", fillFnc)
	.on("mouseover", mouseoverFnc)
	.each(function(d){
	    d3.select(this)
		.transition().duration(arcDur)
		.attrTween("d", tweenArc({
		    startAngle: d.newSel.startAngle,
		    endAngle: d.newSel.endAngle
		}, obj.arc))
		.each("end", function(d) {
		    d3.select(this)
			.transition().duration(opacDur)
			.style("fill-opacity",endFillOpacity);
		});
	});

}

// sets stats divs texts to original values
function statsText(){
    rangeStats.text(dateF(range[0]) + " \u2015 " + dateF(range[1]));
    sunStats.text("Mean length of day: "+sun.meanAll+" hours"); 
    moonStats.text("Mean length of lunar day: "+moon.meanAll+" hours");
}

// gets new array with differences between each time interval, in milliseconds
// N.B. you always need to use 'shift' after this function, due to the extraneous 0 at front
function ms_time_diff(d, i, array) {
    return i > 0 ? +d - +array[i-1] : 0 ;
}
// wrapper:
function ms_time_diffS(array) {
    array1 = array.map(ms_time_diff);
    array1.shift();
    return array1;
}

// gets mean of ms time differences, converts to hours, rounds to 2 decimal places
function ms_to_hours_mean(ms_array){
    var total = 0, i = ms_array.length;
    while(i--){
	total += ms_array[i];
    };
    return Math.round((total*100)/(ms_array.length*1000*60*60))/100;
}

// takes array of datetime data, new start date, new end date; returns three corresponding separate arrays of ms differences
function split_time(date_array, new_start, new_end) {
    var split1 = d3.bisect(date_array, new_start),
    split2 = d3.bisect(date_array, new_end),
    newArray1 = date_array.slice(0,split1).concat(new_start),
    newArray2 = date_array.slice(split1,split2).concat(new_end),
    newArray3 = date_array.slice(split2,date_array.length);
    newArray2.unshift(new_start);
    newArray3.unshift(new_end);
    return [ms_time_diffS(newArray1), ms_time_diffS(newArray2), ms_time_diffS(newArray3)];
}

function tweenArc(b, draw_function) {
  return function(a) {
    var i = d3.interpolate(a, b);
    for (var key in b) a[key] = b[key];
    return function(t) {
	return draw_function(i(t));
    };
  };
}

function radianConvert(Rx, Ry) {
    var angle;
    if(Rx > 0 && Ry > 0) {
	angle = Math.atan(Ry/Rx);
    } else if (Rx > 0 && Ry < 0) {
	angle = Math.atan(Ry/Rx) + 2*Math.PI;
    } else {
	angle = Math.atan(Ry/Rx) + Math.PI;
    };
    return angle;
}

function alternatingFill(d, i, obj) { //fill
    if (regex.rise.test(obj.events[i]) || obj.events[i] == "light" ) { 
	return obj.col1;
    } else if (regex.set.test(obj.events[i]) || obj.events[i] == "dark") { 
	return obj.col2;
    } else if (obj.events[i] == "spl1") {
	return regex.rise.test(obj.events[i-1]) ||  obj.events[i-1] == "light" ? 
	    obj.col1 : obj.col2;
    } else if (obj.events[i] == "spl2") { 
	if (obj.events[i-1] == "spl1") { 
	    // if preceded by spl1 in same cell take 2-back color, else take 1-back
	    return regex.rise.test(obj.events[i-2]) || obj.events[i-2] == "light" ? 
		obj.col1 : obj.col2;
	} else { 
	    return regex.rise.test(obj.events[i-1]) ? 
		obj.col1 : obj.col2; 
	};
    };
}

function dateText(d, i, obj, regexp){
    if (regexp.test(obj.events[i])) { 
	Dtext = dateF(obj.dates[i]) + ": ";
	Ttext = obj.events[i] + " at " + dateT(obj.dates[i]);
    } else { 
	Dtext = dateF(obj.dates[0]); 
	Ttext = " \u2015 " + dateF(obj.dates[obj.dates.length-1]);
    };
    dateLabel.text(Dtext); 
    timeLabel.text(Ttext);
}


