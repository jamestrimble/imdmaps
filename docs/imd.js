"use strict";

(function() {
    var initialOpacity = 82;
    var colourSchemes = [
        {
            "index": 0,
            "name": "10% bands (deciles)",
            "description": "",
            "colours": ['#a50026','#d73027','#f46d43','#fdae61','#fee090','#e0f3f8',
                        '#abd9e9','#74add1','#4575b4','#313695'],
            "breaks": [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
        },
        {
            "index": 1,
            "name": "20% bands (quintiles)",
            "description": "",
            "colours": ['#d7191c','#fdae61','#ffffbf','#abd9e9','#2c7bb6'],
            "breaks": [20, 40, 60, 80, 100]
        },
        {
            "index": 2,
            "name": "Most deprived 25%, in 5% bands",
            "description": "",
            "colours": ['#d73027','#fc8d59','#fee090','#e0f3f8','#91bfdb','#4575b4'],
            "breaks": [5, 10, 15, 20, 25, 100]
        }
    ];
    colourSchemes.forEach(function(colourScheme) {
        var colours = colourScheme.colours;
        var breaks = colourScheme.breaks;
        colourScheme.bands = [];
        for (var i=0; i<colours.length; i++) {
            colourScheme.bands.push({gt: i ? breaks[i-1] : 0, leq: breaks[i], colour: colours[i]});
        }
    });

    var colourScheme = colourSchemes[0];

    var selectedDomain = 0;

    function clearLegendText() {
        d3.select("#legend").html("");
    }

    function zeroPad(n) {
        // Convert to string, and pad with leading zeroes to six digits
        return ("000000" + n).slice(-6);
    }

    function getDecile(rankX100, numZones) {
        // I've implemented it this way to avoid any risk of floating-point imprecision
        for (var i=1; i<=10; i++)
            if (rankX100 <= numZones * i * 10)
                return i;
    }

    function addCommasToNumber(n) {
        // Formats a number with commas every 3 digits
        n = n + "";
        if (n.length <= 3) {
            return n;
        } else {
            return addCommasToNumber(n.slice(0, -3)) + "," + n.slice(-3);
        }
    }

    function setLegendText(imdConfig, feature) {
        clearLegendText();
        var zoneCode = imdConfig.zoneCodePrefix + zeroPad(feature.properties[imdConfig.zoneCodeField]);
        var title = zoneCode + ": " +
                    imdConfig.zoneCodeToName[zoneCode];

        d3.select("#legend").append("div")
            .text("✕")
            .classed("close-x", true);

        d3.select("#legend").append("h2").text(title);

        d3.select("#legend").append("div").text(
            "The middle column shows how this " + imdConfig.zoneType +
            " ranks on the overall " + imdConfig.shortName +
            " and on each domain, where 1 is the most deprived " + imdConfig.zoneType +
            " in " + imdConfig.country +
            " and " + addCommasToNumber(imdConfig.numZones) +
            " is the least deprived. In the final column, deciles range from 1 (most deprived 10% of " + imdConfig.zoneType +
            "s) to 10 (least deprived 10%).");

        var table = d3.select("#legend").append("table");

        var thead_row = table.append("thead").append("tr");

        var tableHeadings = [
            {text: "Index/Domain", align: "left"},
            {text: "Rank", align: "right"},
            {text: "Decile", align: "right"}
        ];
        tableHeadings.forEach(function(d) {
            thead_row.append("th")
                .style("text-align", d.align)
                .text(d.text);
        });

        table.append("tbody").selectAll("tr")
            .data(imdConfig.domains)
            .enter()
            .append("tr")
            .call(populateRow);
            
        var atLeastOneNonIntegerRank = false;
        for (var i=0; i<imdConfig.domains.length; i++) {
            atLeastOneNonIntegerRank = atLeastOneNonIntegerRank || feature.properties['r'+i+'X100'] % 100;
        }
        if (atLeastOneNonIntegerRank) {
            d3.select('#legend').append('div').attr('class', 'non-integer-rank-note').append('i')
                .text(imdConfig.nonIntegerRankNote);
        }

        function populateRow(row) {
            row.append("td").text(function(d) {return d;});
            row.append("td")
                .style("text-align", "right")
                .text(function(d, i) {
                    var rankX100 = feature.properties['r'+i+'X100'];
                    // We assume that rankX100 ends in 00 or 50.
                    return addCommasToNumber((rankX100 - rankX100 % 100) / 100) + (rankX100 % 100 ? '.5*' : '');
                });
            row.append("td")
                .style("text-align", "right")
                .text(function(d, i) {return getDecile(feature.properties['r'+i+'X100'], imdConfig.numZones);});
        }
    }

    function createMapClickListener(imdConfig, map) {
        map.on('click', function (e) {
            var features = map.queryRenderedFeatures(e.point,
                { layers: colourScheme.bands.map(function(d, i) {return 'scheme-'+colourScheme.index+'-band-' + i}) });
            if (features.length) {
                var feature = features[0];
                map.setFilter("zone-highlight", ["==", imdConfig.zoneCodeField, feature.properties[imdConfig.zoneCodeField]]);
                setLegendText(imdConfig, feature);
            } else {
                map.setFilter("zone-highlight", ["==", imdConfig.zoneCodeField, -1]);
                clearLegendText();
            }
        });
    }        

    function createMapLayers(imdConfig, map) {
        // Borders
        map.addLayer({
            id: 'zone-borders',
            type: 'line',
            source: 'zones',
            'source-layer': imdConfig.zoneLayer,
            paint: {
              'line-color': 'white',
              'line-opacity': {stops: [[7, 0], [9,.1], [11, .5], [14,.7]]}
            }
        }, 'place-neighbourhood');

        // Highlight later
        map.addLayer({
            id: 'zone-highlight',
            type: 'line',
            source: 'zones',
            'source-layer': imdConfig.zoneLayer,
            paint: {
              'line-color': '#ffffff',
              'line-opacity': 1,
              'line-width': {stops: [[9, 1], [11,3]]}
            },
            filter: ['<', 'r0X100', 0]
        }, 'place-neighbourhood');
    }

    function removeColourLayers(map) {
        colourScheme.bands.forEach(function(band, i) {
            map.removeLayer('scheme-'+colourScheme.index+'-band-' + i);
        });
    }

    function colourMap(imdConfig, map) {
        colourScheme.bands.forEach(function(band, i) {
            var filter = [ 'all',
                ['>', 'r'+selectedDomain+'X100', band.gt * imdConfig.numZones],
                ['<=', 'r'+selectedDomain+'X100', band.leq * imdConfig.numZones]
            ];

            if (map.getLayer('scheme-'+colourScheme.index+'-band-' + i)) {
                map.setFilter('scheme-'+colourScheme.index+'-band-' + i, filter);
            } else {
                var layerConfig = {
                    id: 'scheme-'+colourScheme.index+'-band-' + i,
                    type: 'fill',
                    source: 'zones',
                    'source-layer': imdConfig.zoneLayer,
                    paint: {
                      'fill-color': band.colour,
                      'fill-opacity': initialOpacity/100,
                    },
                    filter: filter
                };
                map.addLayer(
                    layerConfig,
                    "zone-borders" // Add the new layer before the one named here
                );
            }
        });
    }

    function createMap(imdConfig) {
        var map = new mapboxgl.Map({
            container: 'map', // container id
            style: imdConfig.baseStyle,
            maxBounds: imdConfig.maxBounds,
            maxZoom: 17,
            minZoom: imdConfig.minZoom 
        });
        map.fitBounds(imdConfig.initialBounds);
        map.dragRotate.disable();
        map.touchZoomRotate.disableRotation();
        // map.addControl(new mapboxgl.Geocoder());
        return map;
    }

    function changeDomain(domain, domainIndex, imdConfig, map) {
        selectedDomain = domainIndex;
        colourMap(imdConfig, map);
    }

    function createDomainButtons(imdConfig, map) {
        var container = d3.select("#domain-select").append("div");
        var domainButtons = container.selectAll("button")
            .data(imdConfig.domains)
            .enter()
            .append("button")
            .text(function(d) {return d})
            .classed('highlight', function(d, i) {return i==0;})
            .on('click', function(d, i) {
                changeDomain(d, i, imdConfig, map);
                domainButtons.classed('highlight', function(d_, i_) {return i==i_;})
            });
    }

    function createColourSchemeButtons(imdConfig, map, legendDivs) {
        var container = d3.select("#colour-scheme-select").append("div");
        var buttons = container.selectAll("button")
            .data(colourSchemes)
            .enter()
            .append("button")
            .text(function(d) {return d.name})
            .classed('highlight', function(d, i) {return i==0;})
            .on('click', function(d, i) {
                if (d != colourScheme) {
                    removeColourLayers(map);
                    colourScheme = d;
                    console.log(d); 
                    colourMap(imdConfig, map);
                }

                legendDivs.forEach(function(legendDiv, i_) {
                    legendDiv.style("display", i==i_ ? "inline" : "none");
                });
                buttons.classed('highlight', function(d_, i_) {return i==i_;})
            });
    }

    function drawColourScale(imdConfig, map) {
        var xScale = d3.scale.linear().range([0,250]);

        var legendDivs = [];
        var legendRects = [];

        colourSchemes.forEach(function(colourScheme, i) {
            var div = d3.select("#colour-scale-legend-div")
                .append("div")
//                .text(colourScheme.description)
                .style("display", i ? "none" : "inline");

            legendDivs.push(div);

            var svg = div.append('svg').attr('id','colour-scale-svg')
                .attr('height',55)
                .attr('width',250);

            var rects = svg.selectAll('.colour-scale-rect')
                .data(colourScheme.bands)
                .enter()
                .append('rect')
                .attr('class','colour-scale-rect')
                .attr('x',function(d) {return xScale(d.gt/100)})
                .attr('y',25)
                .attr('width', function(d) {return xScale(d.leq/100) - xScale(d.gt/100)})
                .attr('height',15)
                .attr('fill', function(d) {return d.colour});

            legendRects.push(rects);

            var text = [
                {text: "Most deprived", x: xScale(0), y: 20, anchor: "start"},
                {text: "Least deprived", x: xScale(1), y: 20, anchor: "end"}
            ];

            text.forEach(function(entry) {
                svg.append('text')
                    .attr('fill','#000')
                    .attr('x', entry.x)
                    .attr('y', entry.y)
                    .attr('text-anchor', entry.anchor)
                    .text(entry.text)
                    .attr('font-size', '85%');
            });
        });

        var opacityPicker = d3.select('#opacity-span').append('input')
            .attr('type', 'range')
            .attr('min', 10)
            .attr('value', initialOpacity)
            .on('change', function() { changeOpacity(this.value / 100) });

        changeOpacity(opacityPicker.attr("value") / 100);

        function changeOpacity(opacity) {
            legendRects.forEach(function(rects) {
                rects.attr('fill-opacity', opacity);
            });
            for (var i=0; i<colourScheme.bands.length; i++) {
                map.setPaintProperty('scheme-'+colourScheme.index+'-band-'+i, 'fill-opacity', opacity);
            }
        }

        return legendDivs;
    }

    function onMapLoad(imdConfig, map) {
        d3.select('#loading-msg').style('display', 'none');
        var nav = new mapboxgl.Navigation({position: 'top-left'});
        map.addControl(nav);
        map.addSource('zones', {'type': 'vector','url': imdConfig.tileset });
        createMapLayers(imdConfig, map);
        colourMap(imdConfig, map);
        createDomainButtons(imdConfig, map);
        var legendDivs = drawColourScale(imdConfig, map);
        createColourSchemeButtons(imdConfig, map, legendDivs);
        createMapClickListener(imdConfig, map);
        d3.select('#selection-div').style('display', 'inline');
        
        d3.select("#legend").on("click", clearLegendText);
    }

    d3.json("imdconfig.json", function(error, imdConfig) {
        if (error) return console.warn(error);
        mapboxgl.accessToken = imdConfig.mbAccessToken;
        var map = createMap(imdConfig);
        map.on('load', function (e) {
            onMapLoad(imdConfig, map);
        });
    });
}());
