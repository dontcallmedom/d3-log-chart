This library allows to build graphical representations of logs, where a log is assumed to be represented as a set of key/value, e.g.:
```js
{method: "GET", "path": "/", "date": "2015-03-22T13:37:00"}
```

# API
This library is built as a RequireJS module. Assuming you want to use it in a `main.js` file, the following code will load the module:
```html
<script data-main="main.js" src="https://cdnjs.cloudflare.com/ajax/libs/require.js/2.1.16/require.min.js"></script>```
```js
// loading dependencies from CDNs via requireJS
requirejs.config({
  paths: {
      ramda: "https://cdnjs.cloudflare.com/ajax/libs/ramda/0.11.0/ramda",
      d3: "http://d3js.org/d3.v3"
  }
});

require(['../chart'], function (Chart){
});
```

You can use `Chart` to construct new objects:
```js
var c = new Chart(definition);
```

where `definition` is an object that takes the following properties:

* `x` is an array of objects, each of which represent an x axis, and is defined by two properties: `type` (possible values: `unit` and `time`) and `label` (used to annotate the axis on the chart)
* likewise, `y` is an array of objects representing the y axes
* `width` is the width of the chart in pixels
* `height` is the height of the chart in pixels

For instance:
```js
var definition = {
  x:[{type:'time', label: 'Date of event'}],
  y:[{type:'unit', label: '# of events'}],
  width: 600,
  height: 400
};
```
We then draw the axes:
```js
c.drawAxes();
```

We define ways in which we want to split our data through “disaggregators”:
```js
var disaggregators = [{"by HTTP method":
                          {groupBy: function(d) { return d.method;},
                           labels: [{value: "GET", color: "red"},
                                    {value: "POST", color: "green"}]},
                      {"by top-level dir":
                          {groupBy: function(d) { return d.path.split("/")[0];},
                          labels: [{value: "":, color: "yellow"},
                                   {value: "about", color: "blue"}]}
                      ];
```
and use them with the `disaggregators` setter:
```js
c.disaggregators(disaggregators);
```

We apply our data with the `data` setter:
```js
c.data(data);
```

We then just need to define the representation we want, with the `series` setter:
```js
c.series({type: "bar", // bar chart
          groupBy: function(d) { return d.date.slice(0,7);} // group by month
        );
```
The `type` property defines the type of chart that will be used to represent the data: "bar" for a bar  chart, and "line" for a line. The `groupBy` property defines how the data is mapped to the x axis.

Call `series` for each additional representation you want to add in the given chart.


# Examples
* [Stacked bar chart](https://dontcallmedom.github.io/d3-log-chart/examples/stackedbarchart.html)

# Dependencies
This library uses [Ramda](http://ramdajs.com) for its set of functional programming tools, and [d3.js](http://d3js.org/) to draw the charts.

# Applicability
This library was built for a specific project of mine; I make no claim on how universally applicable it is. Patches to add new features are much welcomed though.