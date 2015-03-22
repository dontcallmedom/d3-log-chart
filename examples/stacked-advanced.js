require(['../chart'], function (Chart){
  var c = new Chart(chartdef);
  var month = function (d) { return d.date.slice(0, 7);};
  c.drawAxes();
  document.getElementById('advanced').appendChild(c.node);
  c.disaggregators(disaggregators);

  d3.json('data.json', function(error, data) {
   c.data(data)
    .series({ type: "bar",
             groupBy: month
           })
   .draw();
  });
});
