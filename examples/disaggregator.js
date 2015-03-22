var disaggregators = (function () {
   // var continents = { 'Asia': ["Oman", "Pakistan", …], …};

   var byContinent = function(d) {
       var country = d.country;
       var continent = Object.keys(continents).filter(function (c) {
           return continents[c].indexOf(country) !== -1;
       })[0];
       return continent;
   }
   return {
        "global view": {groupBy: prop("foo"),
                        labels: [{value:"undefined",
                                  name:"all users",
                                  color: "steelblue"}]},
        "by gender": {groupBy: "gender",
                      labels: [{value:"female", color: "#ff69b4"},
                               {value:"male", color: "#00F"}]},
       "by age": {groupBy: "age",
                  labels: [{value:"18-", color: "yellow"},
                           {value:"18-25",color:"orange"},
                           {value:"25-30", color: "red"},
                           {value: "30-40", color: "purple"},
                           {value: "40-50", color: "marroon"},
                           {value: "50+", color:"gray"}]},
        "by continent": {groupBy: byContinent,
                         labels: [{value:"Asia", color: "#0FF"},
                                  {value: "Africa", color:"#0F0"},
                                  {value: "North America", color: "#FF0"},
                                  {value: "South America", color: "#770"},
                                  {value:"Europe", color: "#077"},
                                  {value: "Oceania", color: "#0A0"}]}
   };
})();
