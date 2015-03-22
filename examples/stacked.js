// loading dependencies from CDNs via requireJS
requirejs.config({
  paths: {
      ramda: "https://cdnjs.cloudflare.com/ajax/libs/ramda/0.11.0/ramda",
      d3: "http://d3js.org/d3.v3"
  }
});

require(['../chart'], function (Chart){
  var c = new Chart(chartdef);
  var month = function (d) { return d.date.slice(0, 7);};
  c.drawAxes();
  document.getElementById('chart').appendChild(c.node);
  c.disaggregators(disaggregators);

  d3.json('data.json', function(error, data) {
   c.data(data)
    .series({ type: "bar",
             groupBy: month
           })
   .draw();
  });
});
