require(['../chart'], function (Chart){
  var c = new Chart(chartdef);
  var month = function (d) { return d.date.slice(0, 7);};
  c.drawAxes();
  document.getElementById('advanced').appendChild(c.node);
  c.disaggregators(disaggregators);

  // we add the legend and the disaggregator selector
  var div = document.createElement("div");
  div.className = "chart-control";
  div.appendChild(c.uiNode);
  div.appendChild(c.legendNode);
  document.getElementById('advanced').appendChild(div);

  d3.json('data.json', function(error, data) {
   c.data(data)
    .series({ type: "bar",
             groupBy: month
           })
   .draw();
  });
});
