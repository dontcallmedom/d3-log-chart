define(['ramda', 'd3'], function (R, d3) {
    return function (options) {
        // normalization
        options.y = Array.isArray(options.y) ? options.y : [options.y];
        options.x = Array.isArray(options.x) ? options.x : [options.x];

        /* empty initializations */
        var xs = [];
        var xAxes = [];

        var yAxes = [];
        var ys = [];

        var dataSeries;
        var _series = [];

        var _data;

        var _disaggregators = {};
        var currentDisaggregator;

        /* initial constant values */
        var legendWidth = 200;

        var yAxisOrientation = ["left", "right"];

        var margin = {top: 40, right: 20, bottom: 40, left: 80};

        /* from options */

        var width = options.width - margin.left - margin.right;
        var height = options.height - margin.top - margin.bottom;
        var extraWidth = options.extraWidth || 0;

        var textures = R.clone(options.textures) || {} ;


        /* helper functions */

        // property getter (like R.prop) with fallback on the 2nd property
        // if 1st one is null undefined
        var propAOrB = R.flip(R.useWith(R.converge(R.defaultTo), R.prop, R.prop));

        function sortByArrayOrder(array) {
            array = Array.isArray(array) ? array : [];
            var arrayIndex = R.indexOf(R.__, array);
            return R.useWith(d3.ascending, arrayIndex, arrayIndex);
        }

        function sortByKey(key) {
            return R.useWith(d3.ascending, R.prop(key), R.prop(key));
        }


        function nestBy(key) {
            key = key || R.always("_");
            return function(f) {
                return f.key(key)
                    .sortKeys(d3.ascending);
            };
        }

        function stack(chartType) {
            if (chartType === "bar") {
                return d3.layout.stack()
                    .values(R.prop("values"))
                    .x(R.prop("key"))
                    .y(R.prop("values"))
                    .out(function(d, y0) { d.valueOffset = y0 || 0; });
            }
            return R.identity;
        }

        function formatTime(t) {
            return new Date(Date.parse(t));
        }

        // from http://bl.ocks.org/mbostock/7555321
        function wrap(text, width) {
            text.each(function() {
                var text = d3.select(this),
                    words = text.text().trim().split(/\s+/).reverse(),
                    word,
                    line = [],
                    lineNumber = 0,
                    lineHeight = 1.1, // ems
                    y = text.attr("y"),
                    dy = parseFloat(text.attr("dy")),
                    tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
                while (word = words.pop()) {
                    line.push(word);
                    tspan.text(line.join(" "));
                    if (tspan.node().getComputedTextLength() > width) {
                        line.pop();
                        tspan.text(line.join(" "));
                        line = [word];
                        tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
                        if (tspan.node().getComputedTextLength() > width && word.length > Math.round(width/8) + 1) {
                            tspan.text(word.slice(0, Math.round(width/8)) + '…');
                            tspan.append("title")
                                .text(word);
                        }
                    }
                }
            });
        }

        function formatData(type) {
            if (type === "day" || type === "month") {
                return formatTime;
            } else if (typeof type === "function") {
		return type;
	    }
            return R.identity;
        }

        function integrate(array, key) {
            key = key || "values";
            return array.map(function (l, i) {
                if (i > 0) {
                    l[key] += array[i - 1][key];
                }
                return l;
            });
        }

        /* variable setting */

        var svgroot = d3.select(document.createElementNS("http://www.w3.org/2000/svg", "svg"))
            .attr({width: width + margin.left + margin.right + extraWidth,
                   height: height + margin.top + margin.bottom});

        var legendroot = d3.select(document.createElementNS("http://www.w3.org/2000/svg", "svg"))
            .attr({width: legendWidth});

        var uiroot = d3.select(document.createElement("div"));

        var svg = svgroot.append("g")
            .attr("transform",
                  "translate(" + margin.left + "," + margin.top + ")");

        // preparing axis
        options.x.forEach(function(x, i) {
            var offset = x.offset || 0;
            xs.push(d3.scale.ordinal().rangeRoundBands([offset, offset + width], 0.05));

            if (x.type === "none") {
                return;
            }

            var axis = d3.svg.axis()
                .scale(xs[i])
                .orient("bottom");
            if (x.type === "day") {
                axis = axis.tickFormat(d3.time.format("%Y %b %d"));
            } else if (x.type === "month") {
                axis = axis.tickFormat(d3.time.format("%Y %b"));
            }
            xAxes.push(axis);
        });

        options.y.forEach(function(y, i) {
            ys.push(d3.scale.linear().range([height, 0]));
            yAxes.push(d3.svg.axis()
                       .scale(ys[i])
                       .orient(y.orient || "left")
                       .ticks(10)
                      );
        });


        // organize data in a manageable structure
        function processSeries(s) {
            s.data = {};
            var filteredData = _data;
            if (s.filter) {
                filteredData = _data.filter(s.filter);
            }

            s.disaggregators = s.disaggregators || Object.keys(_disaggregators);
            s.labelTypes = s.labelTypes || [];

            s.labeller = s.labeller || function (absValue, total, xData, category) { return "" + absValue +  "/" + total + " (" + Math.round(100*absValue/total) + "%) " + xData + " / " + category};
            // normalize s.width and s.offset to be always functions
            var width = s.width;
            s.width = s.width ? (typeof s.width === "function" ? s.width : function() { return width;}) : function(band) { return (s.labelTypes.length > 0 && band > 20 ? band - 20 : band);};
            var abscisses = Object.keys(d3.nest().key(s.groupBy).sortKeys(d3.ascending).map(filteredData)).sort();
            s.disaggregators.forEach(function (k) {
                var order = _disaggregators[k].labels.map(R.prop("value"));
                var ds = d3.nest().key(_disaggregators[k].groupBy)
                    .sortKeys(sortByArrayOrder(order));
                ds = nestBy(s.groupBy)(ds);
                ds = ds.rollup(R.length).entries(filteredData);

                var missingLabels = R.difference(ds.map(R.prop("key")), order).sort();
                missingLabels = R.difference(missingLabels, ["__nogroup"]);
                _disaggregators[k].labels = _disaggregators[k].labels.concat(missingLabels.map(R.assoc("value", R.__, {})));

                if (s.process === "integrate") {
                    ds = ds.map(function (o) { o.values = integrate(o.values); return o;});
                }
                // there may abscisses where no data was collected
                // we need to fill that gap
                ds.forEach(function (o) {
                    var values = o.values;
                    var localAbscisses = values.map(R.prop("key"));
                    var missingAbscisses = R.difference(abscisses, localAbscisses);
                    values = values.concat(missingAbscisses.map(R.assoc("key", R.__, {values:0})));
                    o.values = values.sort(sortByKey("key"));
                });
                s.data[k] = stack(s.type, abscisses)(ds);
                dataSeries.push(s);
            });

            var i = s.xAxis;
            var x = xs[i];
            // determine the range of values for axis based on data
            var type = options.x[i].type;
            if (type !== "none") {
                var relevantSeries = dataSeries.filter(R.propEq("xAxis", i));
                var abscisses = [];
                relevantSeries.forEach(function (s) {
                    s.disaggregators.forEach(function (by) {
                        s.data[by].forEach(function (l) {
                            abscisses = abscisses.concat(l.values.map(R.prop("key")));
                        });
                    });
                });
                abscisses = d3.set(abscisses).values().map(formatData(type)).sort(s.orderBy ? s.orderBy : undefined);
                x.domain(abscisses);
                x.call(xAxes[i]);
            }

            i = s.yAxis;
            var y = ys[i];

            // TODO: DRY
            type = options.y[i].type;
            if (type !== "none") {
                relevantSeries = dataSeries.filter(R.propEq("yAxis", i));
                var max = 0;
                relevantSeries.forEach(function (s) {
                    s.disaggregators.forEach(function (k) {
                        s.data[k].forEach(function (l) {
                            max = Math.max(max, d3.max(l.values, R.prop("values")));
                        });
                    });
                });
                y.domain([0, max]);
                yAxes[i].ticks(Math.min(max,10));
            }
            drawAxes();
        }

        function colorScale(by) {
            var scaleSize = _disaggregators[by].labels.length;
            var palette;
            if (scaleSize <= 10) {
                palette = d3.scale.category10().range();
            } else if (scaleSize <= 20) {
                palette = d3.scale.category20().range();
            } else if (scaleSize <= 40) {
                palette = d3.scale.category20().range().concat(d3.scale.category20b().range());
            } else if (scaleSize <= 60) {
                palette = d3.scale.category20().range().concat(d3.scale.category20b().range()).concat(d3.scale.category20c().range());
            } else {
                console.error("d3-log-chart doesn't support more than 60 colors in its default palette");
            }

            // we keep only colors that aren't used in the ones provided
            var definedColors = _disaggregators[by].labels.map(R.prop("color"));
            palette = R.difference(palette, definedColors);

            var paletteIndex = 0;
            _disaggregators[by].labels.forEach(function(l) {
                if (l.color === undefined) {
                    l.color = palette[paletteIndex];
                    paletteIndex++;
                }
            });

            return d3.scale.ordinal()
                .domain(_disaggregators[by].labels.map(propAOrB("name", "value")))
                .range(_disaggregators[by].labels.map(R.prop("color")));
        }

        function drawChartLine(s, by) {
            var x = xs[s.xAxis];
            var y = ys[s.yAxis];
            var xType = options.x[s.xAxis].type;
            var line = d3.svg.line()
                .x(R.compose(x, formatData(xType), R.prop("key")))
                .y(R.compose(y, R.prop("values")));
            svg.append("path")
                .datum(s.data[by][0].values)
                .attr({"d": line, "class": "line"});
        }

        function setTexture(node, name, color) {
            color = color || "white";
            if (!name) {
                return color;
            }
            var texture = textures[name].texture;
            var t;
            if (texture === "crosses") {
                t = window.textures.paths().d("crosses").size(6);
            } else if (texture === "grid") {
                t = window.textures.lines()
                    .orientation("vertical", "horizontal")
                    .size(4)
                    .strokeWidth(1)
                    .shapeRendering("crispEdges");
            } else {
                t = window.textures[texture]().size(6);
            }
            t.background(color);
            node.call(t);
            return t.url();
        }

        function drawChartBar(s, by, n) {
            var x = xs[s.xAxis];
            var y = ys[s.yAxis];
            var xType = options.x[s.xAxis].type;
            var colors = colorScale(by);

            var g = svg.selectAll(".chart" + n).data([""]);
            g.enter().append("g")
                .attr("class", "chart" + n);
            if (s.xOffset) {
                var offset = typeof s.xOffset === "function" ? s.xOffset(x.rangeBand()) : s.xOffset;
                g.attr("transform", "translate(" + (offset || 0) + ",0)");
            }
            g.exit().remove();
            var bars = g.selectAll('.bars').data(s.data[by]);
            bars.enter().append("g")
                .attr("class", "bars");
            bars.attr("fill", function(d) {
                return setTexture(g, s.texture, colors(d.key) || "steelblue");
            })
                .property("title", R.prop("key"));
            bars.exit().remove();
            var total = 0;
            s.data[by].forEach(function(segment) {
                total += d3.sum(segment.values, R.prop("values"));
            });

            var catTotal = 0;
            // TODO: kludge
            var totalDisaggregator = s.disaggregators[s.disaggregators.length - 1];
            s.data[totalDisaggregator].forEach(function(segment) {
                catTotal += d3.sum(segment.values, R.prop("values"));
            });

            bars = g.selectAll(".bars");
            var bar = bars.selectAll("rect")
                .data(R.prop("values"));

            var colTotal = function(d) {
                return s.data[totalDisaggregator][0].values.filter(function(x) { return x.key==d.key;})[0].values
            }

            bar.enter().append("rect")
                .append("title");
            bar.exit().remove();

            bar.attr("x", R.compose(x, formatData(xType), R.prop("key")))
                .attr("width", s.width(x.rangeBand()))
            bar.attr("y", function(d) { return y(d.values + d.valueOffset) ; })
            // y.range()[0] - y(d.values)
                .attr("height", R.compose(R.subtract(y.range()[0]), y, R.prop("values")))
                .select("title").text(function(d) { return s.labeller(d.values, colTotal(d) , formatData(options.x[s.xAxis].type)(d.key), this.parentNode.parentNode.title);});

            var labellers = {
                "unit": R.prop("values"),
                "percent": function(d) { return Math.round((d.values / total)*100) + "%";}
            };
            s.labelTypes.map(function(labelType, i) {
                var text = bars.selectAll("text." + labelType)
                    .data(R.prop("values"));
                text.enter().append("text")
                    .attr({transform: "rotate(-90)", "class": labelType, fill: "black"})
                    .style("text-anchor", "middle");
                text.attr("x", function(d) { return -((y.range()[0] - y(d.values))/2 + y(d.values + d.valueOffset));})
                    .attr("dy", i ? "1em" : "-0.2em")
                    .attr("y", function(d) { return x(formatData(xType)(d.key)) + (i ==1 ? s.width(x.rangeBand()) : 0); })
                    .text(labellers[labelType]);
                text.exit().remove();
            });
            var fontSize = Math.min(x.rangeBand() - 2, 10);
            var text = svg.selectAll("text.catpercent")
                .data((s.data[totalDisaggregator][0] || {}).values || []);
            text.enter()
                .append("text")
                .attr("font-size", fontSize)
                .attr("class", "catpercent")
                .attr("text-anchor", "middle");
            text.attr("x", function(d) { return x(formatData(xType)(d.key)) + s.width(x.rangeBand()) / 2; })
                .attr("y", y(0))
                .text(function(d) {
                    var value= Math.round((d.values / catTotal)*100) ;
                    return value ? value + "%" : ""
                });
            text.exit().remove();
        }

        function setDisaggregator(disaggregateBy) {
            currentDisaggregator = disaggregateBy ? disaggregateBy : (currentDisaggregator ? currentDisaggregator : Object.keys(_disaggregators)[0]);
            disaggregateBy = disaggregateBy || currentDisaggregator;
            updateLegend(disaggregateBy);
            _series.forEach(function (s, n) {
                var by = disaggregateBy;
                if (s.disaggregators && s.disaggregators.indexOf(by) === -1) {
                    by = currentDisaggregator;
                }
                if (s.type === "line") {
                    drawChartLine(s, by);
                } else if (s.type === "bar") {
                    drawChartBar(s, by, n);
                }
            });
            return this;
        }

        function drawAxes() {
            function navigate(linker) {
              return function(d) {
                  document.location.href= linker(d);
              };
            }

            svg.selectAll(".axis").remove();
            xs.forEach(function (x, i) {
                var linkAttr = {};
                svg.append("g")
                    .attr({"class": "x axis",
                           "transform": "translate(" + (options.x[i].offset || 0) + "," + height + ")"})
                    .call(xAxes[i])
                    .append("text")
                    .attr({"x": options.x[i].width || width,
                           "dy": "2.3em"})
                    .style("text-anchor", "end")
                    .text(options.x[i].label || "");
                // avoid repeating information common to the start of a sequence of ticks
                var ticks = svg.selectAll(".x .tick text")[0];
		var maxTickHeight = margin.bottom;

                svg.selectAll(".x .tick text")
                    .call(wrap, x.rangeBand());
		// FIXME: do not hardcode font size
                ticks.forEach(function(t) {
		    maxTickHeight = Math.max(t.querySelectorAll("tspan").length*12, maxTickHeight);
                });

                if (options.x[i].linker) {
                  svg.selectAll(".x .tick text")
                    .style("cursor", "pointer")
                    .style("text-decoration", "underline")
                    .style("fill", "blue")
                    .attr("focusable","true")
                    .on("click", navigate(options.x[i].linker));
                }

		if (maxTickHeight > margin.bottom) {
		    svgroot.attr("height", parseInt(svgroot.attr("height"), 10) + maxTickHeight - margin.bottom);
		}
            });

            ys.forEach(function (y, i) {
                svg.append("g")
                    .attr({"class": "y axis",
                           "transform": "translate(" + ((options.y[i].offset || 0) + (options.y[i].orient == "right" ? width : 0)) + ",0)"})
                    .call(yAxes[i])
                    .append("text")
                    .attr({ "y": 0,
                           "dy": "-.6em"})
                    .style("text-anchor", "start")
                    .text(options.y[i].label);
            });
            return this;
        }

        function drawLegend() {
            uiroot.selectAll("select").data(['']).enter()
                .append("select")
                .attr("name", "disaggregateBy")
                .on("change", function() { setDisaggregator(Object.keys(_disaggregators)[this.selectedIndex]);})
                .selectAll("option")
                .data(Object.keys(_disaggregators))
                .enter().append("option")
                .attr("checked", R.eq(currentDisaggregator))
                .text(R.identity);

            // filter out textures that aren't used
            var usedTextures = Object.keys(textures)
                .filter(function (t) {
                    return _series.reduce(function (prev, cur) { return prev || cur.texture === t;}, false);
                }).map(R.propOf(textures));

            var keys = legendroot.selectAll(".keys")
                .data(["texture", "disaggregator"])
                .enter().append("g")
                .attr("class", R.identity)
                .classed("keys", true);
            drawLegendGroup(usedTextures,
                            // setTexture(keys, _.name)
                            R.compose(R.curry(R.binary(setTexture))(keys), R.prop("name")),
                            "texture");
        }

        function drawLegendGroup(legends, fillFunction, groupname, offset) {
            offset = offset || 0;
            var keys = legendroot.selectAll(".keys." + groupname);
            var squares = keys.selectAll("rect." + groupname)
                .data(legends);
            squares.enter().append("rect")
                .attr({"class": groupname, "width": 20, "height": 20});
            squares.attr("y", function(d, i) { return (offset + i)*30 ;})
                .attr("fill", fillFunction);
            squares.exit().remove();

            var labels = keys.selectAll("text." + groupname)
                .data(legends);
            labels.enter().append("text")
                .attr({"class": groupname, x: 25});
            labels.text(propAOrB("name", "value"))
                .attr("y", function(d, i) { return (offset + i)*30 + 15;});
            labels.exit().remove();
        }

        function updateLegend(by) {
            var colors = colorScale(by);
            var fillFunction = function(d, i) { return colors(i)};
            drawLegendGroup(_disaggregators[by].labels,
                            fillFunction,
                            "disaggregator",
                            legendroot.node().querySelectorAll(".keys rect.texture").length
                           );
        }

        function disaggregators(d) {
            _disaggregators = R.mapObj(function (l) {
                var m = R.clone(l);
                if (typeof m.groupBy === "string") {
                    m.groupBy = R.prop(m.groupBy);
                } else if (m.groupBy === undefined) {
                    m.groupBy = R.always("__nogroup");
                }
                if (m.labels === undefined) {
                    m.labels = [];
                }
                return m;
            }, d);
            return this;
        }

        function data(d) {
            _data = d;
            dataSeries = [];
            return this;
        }

        function series(s) {
            var series = R.clone(s);
            series.xAxis = series.xAxis || 0;
            series.yAxis = series.yAxis || 0;
            _series.push(series);
            return this;
        }

        function draw() {
            _series.forEach(s => processSeries(s));
            drawLegend();
            setDisaggregator();
            return this;
        }

        var api = {
            drawAxes: drawAxes,
            disaggregators: disaggregators,
            data: data,
            draw: draw,
            series: series,
            setDisaggregator: setDisaggregator,
            node: svgroot.node(),
            legendNode: legendroot.node(),
            uiNode: uiroot.node()
        };

        return api;
    }
});
