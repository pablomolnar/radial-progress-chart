(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.RadialProgressChart = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var d3;

// RadialProgressChart object
function RadialProgressChart(query, options) {

  // verify d3 is loaded
  d3 = (typeof window !== 'undefined' && window.d3) ? window.d3 : typeof require !== 'undefined' ? require("d3") : undefined;
  if(!d3) throw new Error('d3 object is missing. D3.js library has to be loaded before.');

  var self = this;
  self.options = RadialProgressChart.normalizeOptions(options);

  // internal  variables
  var series = self.options.series
    , width = 15 + ((self.options.diameter / 2) + (self.options.stroke.width * self.options.series.length) + (self.options.stroke.gap * self.options.series.length - 1)) * 2
    , height = width
    , dim = "0 0 " + height + " " + width
    , τ = 2 * Math.PI
    , inner = []
    , outer = [];

  function innerRadius(item) {
    var radius = inner[item.index];
    if (radius) return radius;

    // first ring based on diameter and the rest based on the previous outer radius plus gap
    radius = item.index === 0 ? self.options.diameter / 2 : outer[item.index - 1] + self.options.stroke.gap;
    inner[item.index] = radius;
    return radius;
  }

  function outerRadius(item) {
    var radius = outer[item.index];
    if (radius) return radius;

    // based on the previous inner radius + stroke width
    radius = inner[item.index] + self.options.stroke.width;
    outer[item.index] = radius;
    return radius;
  }

  self.progress = d3.svg.arc()
    .startAngle(0)
    .endAngle(function (item) {
      return item.percentage / 100 * τ;
    })
    .innerRadius(innerRadius)
    .outerRadius(outerRadius)
    .cornerRadius(function (d) {
      // Workaround for d3 bug https://github.com/mbostock/d3/issues/2249
      // Reduce corner radius when corners are close each other
      var m = d.percentage >= 90 ? (100 - d.percentage) * 0.1 : 1;
      return (self.options.stroke.width / 2) * m;
    });

  var background = d3.svg.arc()
    .startAngle(0)
    .endAngle(τ)
    .innerRadius(innerRadius)
    .outerRadius(outerRadius);

  // create svg
  self.svg = d3.select(query).append("svg")
    .attr("preserveAspectRatio","xMinYMin meet")
    .attr("viewBox", dim)
    .append("g")
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

  // add gradients defs
  var defs = self.svg.append("svg:defs");
  series.forEach(function (item) {
    if (item.color.linearGradient || item.color.radialGradient) {
      var gradient = RadialProgressChart.Gradient.toSVGElement('gradient' + item.index, item.color);
      defs.node().appendChild(gradient);
    }
  });

  // add shadows defs
  defs = self.svg.append("svg:defs");
  var dropshadowId = "dropshadow-" + Math.random();
  var filter = defs.append("filter").attr("id", dropshadowId);
  if(self.options.shadow.width > 0) {
    
    filter.append("feGaussianBlur")
      .attr("in", "SourceAlpha")
      .attr("stdDeviation", self.options.shadow.width)
      .attr("result", "blur");

    filter.append("feOffset")
      .attr("in", "blur")
      .attr("dx", 1)
      .attr("dy", 1)
      .attr("result", "offsetBlur");
  }

  var feMerge = filter.append("feMerge");
  feMerge.append("feMergeNode").attr("in", "offsetBlur");
  feMerge.append("feMergeNode").attr("in", "SourceGraphic");

  // add inner text
  if (self.options.center) {
    self.svg.append("text")
      .attr('class', 'rbc-center-text')
      .attr("text-anchor", "middle")
      .attr('x', self.options.center.x + 'px')
      .attr('y', self.options.center.y + 'px')
      .selectAll('tspan')
      .data(self.options.center.content).enter()
      .append('tspan')
      .attr("dominant-baseline", function () {

        // Single lines can easily centered in the middle using dominant-baseline, multiline need to use y
        if (self.options.center.content.length === 1) {
          return 'central';
        }
      })
      .attr('class', function (d, i) {
        return 'rbc-center-text-line' + i;
      })
      .attr('x', 0)
      .attr('dy', function (d, i) {
        if (i > 0) {
          return '1.1em';
        }
      })
      .each(function (d) {
        if (typeof d === 'function') {
          this.callback = d;
        }
      })
      .text(function (d) {
        if (typeof d === 'string') {
          return d;
        }

        return '';
      });
  }

  // add ring structure
  self.field = self.svg.selectAll("g")
    .data(series)
    .enter().append("g");

  self.field.append("path").attr("class", "progress").attr("filter", "url(#" + dropshadowId +")");

  self.field.append("path").attr("class", "bg")
    .style("fill", function (item) {
      return item.color.background;
    })
    .style("opacity", 0.2)
    .attr("d", background);

  self.field.append("text")
    .classed('rbc-label rbc-label-start', true)
    .attr("dominant-baseline", "central")
    .attr("x", "10")
    .attr("y", function (item) {
      return -(
        self.options.diameter / 2 +
        item.index * (self.options.stroke.gap + self.options.stroke.width) +
        self.options.stroke.width / 2
        );
    })
    .text(function (item) {
      return item.labelStart;
    });

  self.update();
}

/**
 * Update data to be visualized in the chart.
 *
 * @param {Object|Array} data Optional data you'd like to set for the chart before it will update. If not specified the update method will use the data that is already configured with the chart.
 * @example update([70, 10, 45])
 * @example update({series: [{value: 70}, 10, 45]})
 *
 */
RadialProgressChart.prototype.update = function (data) {
  var self = this;

  // parse new data
  if (data) {
    if (typeof data === 'number') {
      data = [data];
    }

    var series;

    if (Array.isArray(data)) {
      series = data;
    } else if (typeof data === 'object') {
      series = data.series || [];
    }

    for (var i = 0; i < series.length; i++) {
      this.options.series[i].previousValue = this.options.series[i].value;

      var item = series[i];
      if (typeof item === 'number') {
        this.options.series[i].value = item;
      } else if (typeof item === 'object') {
        this.options.series[i].value = item.value;
      }
    }
  }

  // calculate from percentage and new percentage for the progress animation
  self.options.series.forEach(function (item) {
    item.fromPercentage = item.percentage ? item.percentage : 5;
    item.percentage = (item.value - self.options.min) * 100 / (self.options.max - self.options.min);
  });

  var center = self.svg.select("text.rbc-center-text");

  // progress
  self.field.select("path.progress")
    .interrupt()
    .transition()
    .duration(self.options.animation.duration)
    .delay(function (d, i) {
      // delay between each item
      return i * self.options.animation.delay;
    })
    .ease("elastic")
    .attrTween("d", function (item) {
      var interpolator = d3.interpolateNumber(item.fromPercentage, item.percentage);
      return function (t) {
        item.percentage = interpolator(t);
        return self.progress(item);
      };
    })
    .tween("center", function (item) {
      // Execute callbacks on each line
      if (self.options.center) {
        var interpolate = self.options.round ? d3.interpolateRound : d3.interpolateNumber;
        var interpolator = interpolate(item.previousValue || 0, item.value);
        return function (t) {
          center
            .selectAll('tspan')
            .each(function () {
              if (this.callback) {
                d3.select(this).text(this.callback(interpolator(t), item.index, item));
              }
            });
        };
      }
    })
    .tween("interpolate-color", function (item) {
      if (item.color.interpolate && item.color.interpolate.length == 2) {
        var colorInterpolator = d3.interpolateHsl(item.color.interpolate[0], item.color.interpolate[1]);

        return function (t) {
          var color = colorInterpolator(item.percentage / 100);
          d3.select(this).style('fill', color);
          d3.select(this.parentNode).select('path.bg').style('fill', color);
        };
      }
    })
    .style("fill", function (item) {
      if (item.color.solid) {
        return item.color.solid;
      }

      if (item.color.linearGradient || item.color.radialGradient) {
        return "url(#gradient" + item.index + ')';
      }
    });
};

/**
 * Remove svg and clean some references
 */
RadialProgressChart.prototype.destroy = function () {
  this.svg.remove();
  delete this.svg;
};

/**
 * Detach and normalize user's options input.
 */
RadialProgressChart.normalizeOptions = function (options) {
  if (!options || typeof options !== 'object') {
    options = {};
  }

  var _options = {
    diameter: options.diameter || 100,
    stroke: {
      width: options.stroke && options.stroke.width || 40,
      gap: (!options.stroke || options.stroke.gap === undefined) ? 2 : options.stroke.gap
    },
    shadow: {
      width: (!options.shadow || options.shadow.width === null) ? 4 : options.shadow.width
    },
    animation: {
      duration: options.animation && options.animation.duration || 1750,
      delay: options.animation && options.animation.delay || 200
    },
    min: options.min || 0,
    max: options.max || 100,
    round: options.round !== undefined ? !!options.round : true,
    series: options.series || [],
    center: RadialProgressChart.normalizeCenter(options.center)
  };

  var defaultColorsIterator = new RadialProgressChart.ColorsIterator();
  for (var i = 0, length = _options.series.length; i < length; i++) {
    var item = options.series[i];

    // convert number to object
    if (typeof item === 'number') {
      item = {value: item};
    }

    _options.series[i] = {
      index: i,
      value: item.value,
      labelStart: item.labelStart,
      color: RadialProgressChart.normalizeColor(item.color, defaultColorsIterator)
    };
  }

  return _options;
};

/**
 * Normalize different notations of color property
 *
 * @param {String|Array|Object} color
 * @example '#fe08b5'
 * @example { solid: '#fe08b5', background: '#000000' }
 * @example ['#000000', '#ff0000']
 * @example {
                linearGradient: { x1: '0%', y1: '100%', x2: '50%', y2: '0%'},
                stops: [
                  {offset: '0%', 'stop-color': '#fe08b5', 'stop-opacity': 1},
                  {offset: '100%', 'stop-color': '#ff1410', 'stop-opacity': 1}
                ]
              }
 * @example {
                radialGradient: {cx: '60', cy: '60', r: '50'},
                stops: [
                  {offset: '0%', 'stop-color': '#fe08b5', 'stop-opacity': 1},
                  {offset: '100%', 'stop-color': '#ff1410', 'stop-opacity': 1}
                ]
              }
 *
 */
RadialProgressChart.normalizeColor = function (color, defaultColorsIterator) {

  if (!color) {
    color = {solid: defaultColorsIterator.next()};
  } else if (typeof color === 'string') {
    color = {solid: color};
  } else if (Array.isArray(color)) {
    color = {interpolate: color};
  } else if (typeof color === 'object') {
    if (!color.solid && !color.interpolate && !color.linearGradient && !color.radialGradient) {
      color.solid = defaultColorsIterator.next();
    }
  }

  // Validate interpolate syntax
  if (color.interpolate) {
    if (color.interpolate.length !== 2) {
      throw new Error('interpolate array should contain two colors');
    }
  }

  // Validate gradient syntax
  if (color.linearGradient || color.radialGradient) {
    if (!color.stops || !Array.isArray(color.stops) || color.stops.length !== 2) {
      throw new Error('gradient syntax is malformed');
    }
  }

  // Set background when is not provided
  if (!color.background) {
    if (color.solid) {
      color.background = color.solid;
    } else if (color.interpolate) {
      color.background = color.interpolate[0];
    } else if (color.linearGradient || color.radialGradient) {
      color.background = color.stops[0]['stop-color'];
    }
  }

  return color;

};


/**
 * Normalize different notations of center property
 *
 * @param {String|Array|Function|Object} center
 * @example 'foo bar'
 * @example { content: 'foo bar', x: 10, y: 4 }
 * @example function(value, index, item) {}
 * @example ['foo bar', function(value, index, item) {}]
 */
RadialProgressChart.normalizeCenter = function (center) {
  if (!center) return null;

  // Convert to object notation
  if (center.constructor !== Object) {
    center = {content: center};
  }

  // Defaults
  center.content = center.content || [];
  center.x = center.x || 0;
  center.y = center.y || 0;

  // Convert content to array notation
  if (!Array.isArray(center.content)) {
    center.content = [center.content];
  }

  return center;
};

// Linear or Radial Gradient internal object
RadialProgressChart.Gradient = (function () {
  function Gradient() {
  }

  Gradient.toSVGElement = function (id, options) {
    var gradientType = options.linearGradient ? 'linearGradient' : 'radialGradient';
    var gradient = d3.select(document.createElementNS(d3.ns.prefix.svg, gradientType))
      .attr(options[gradientType])
      .attr('id', id);

    options.stops.forEach(function (stopAttrs) {
      gradient.append("svg:stop").attr(stopAttrs);
    });

    this.background = options.stops[0]['stop-color'];

    return gradient.node();
  };

  return Gradient;
})();

// Default colors iterator
RadialProgressChart.ColorsIterator = (function () {

  ColorsIterator.DEFAULT_COLORS = ["#1ad5de", "#a0ff03", "#e90b3a", '#ff9500', '#007aff', '#ffcc00', '#5856d6', '#8e8e93'];

  function ColorsIterator() {
    this.index = 0;
  }

  ColorsIterator.prototype.next = function () {
    if (this.index === ColorsIterator.DEFAULT_COLORS.length) {
      this.index = 0;
    }

    return ColorsIterator.DEFAULT_COLORS[this.index++];
  };

  return ColorsIterator;
})();


// Export RadialProgressChart object
if (typeof module !== "undefined")module.exports = RadialProgressChart;

},{"d3":undefined}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGQzO1xyXG5cclxuLy8gUmFkaWFsUHJvZ3Jlc3NDaGFydCBvYmplY3RcclxuZnVuY3Rpb24gUmFkaWFsUHJvZ3Jlc3NDaGFydChxdWVyeSwgb3B0aW9ucykge1xyXG5cclxuICAvLyB2ZXJpZnkgZDMgaXMgbG9hZGVkXHJcbiAgZDMgPSAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LmQzKSA/IHdpbmRvdy5kMyA6IHR5cGVvZiByZXF1aXJlICE9PSAndW5kZWZpbmVkJyA/IHJlcXVpcmUoXCJkM1wiKSA6IHVuZGVmaW5lZDtcclxuICBpZighZDMpIHRocm93IG5ldyBFcnJvcignZDMgb2JqZWN0IGlzIG1pc3NpbmcuIEQzLmpzIGxpYnJhcnkgaGFzIHRvIGJlIGxvYWRlZCBiZWZvcmUuJyk7XHJcblxyXG4gIHZhciBzZWxmID0gdGhpcztcclxuICBzZWxmLm9wdGlvbnMgPSBSYWRpYWxQcm9ncmVzc0NoYXJ0Lm5vcm1hbGl6ZU9wdGlvbnMob3B0aW9ucyk7XHJcblxyXG4gIC8vIGludGVybmFsICB2YXJpYWJsZXNcclxuICB2YXIgc2VyaWVzID0gc2VsZi5vcHRpb25zLnNlcmllc1xyXG4gICAgLCB3aWR0aCA9IDE1ICsgKChzZWxmLm9wdGlvbnMuZGlhbWV0ZXIgLyAyKSArIChzZWxmLm9wdGlvbnMuc3Ryb2tlLndpZHRoICogc2VsZi5vcHRpb25zLnNlcmllcy5sZW5ndGgpICsgKHNlbGYub3B0aW9ucy5zdHJva2UuZ2FwICogc2VsZi5vcHRpb25zLnNlcmllcy5sZW5ndGggLSAxKSkgKiAyXHJcbiAgICAsIGhlaWdodCA9IHdpZHRoXHJcbiAgICAsIGRpbSA9IFwiMCAwIFwiICsgaGVpZ2h0ICsgXCIgXCIgKyB3aWR0aFxyXG4gICAgLCDPhCA9IDIgKiBNYXRoLlBJXHJcbiAgICAsIGlubmVyID0gW11cclxuICAgICwgb3V0ZXIgPSBbXTtcclxuXHJcbiAgZnVuY3Rpb24gaW5uZXJSYWRpdXMoaXRlbSkge1xyXG4gICAgdmFyIHJhZGl1cyA9IGlubmVyW2l0ZW0uaW5kZXhdO1xyXG4gICAgaWYgKHJhZGl1cykgcmV0dXJuIHJhZGl1cztcclxuXHJcbiAgICAvLyBmaXJzdCByaW5nIGJhc2VkIG9uIGRpYW1ldGVyIGFuZCB0aGUgcmVzdCBiYXNlZCBvbiB0aGUgcHJldmlvdXMgb3V0ZXIgcmFkaXVzIHBsdXMgZ2FwXHJcbiAgICByYWRpdXMgPSBpdGVtLmluZGV4ID09PSAwID8gc2VsZi5vcHRpb25zLmRpYW1ldGVyIC8gMiA6IG91dGVyW2l0ZW0uaW5kZXggLSAxXSArIHNlbGYub3B0aW9ucy5zdHJva2UuZ2FwO1xyXG4gICAgaW5uZXJbaXRlbS5pbmRleF0gPSByYWRpdXM7XHJcbiAgICByZXR1cm4gcmFkaXVzO1xyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gb3V0ZXJSYWRpdXMoaXRlbSkge1xyXG4gICAgdmFyIHJhZGl1cyA9IG91dGVyW2l0ZW0uaW5kZXhdO1xyXG4gICAgaWYgKHJhZGl1cykgcmV0dXJuIHJhZGl1cztcclxuXHJcbiAgICAvLyBiYXNlZCBvbiB0aGUgcHJldmlvdXMgaW5uZXIgcmFkaXVzICsgc3Ryb2tlIHdpZHRoXHJcbiAgICByYWRpdXMgPSBpbm5lcltpdGVtLmluZGV4XSArIHNlbGYub3B0aW9ucy5zdHJva2Uud2lkdGg7XHJcbiAgICBvdXRlcltpdGVtLmluZGV4XSA9IHJhZGl1cztcclxuICAgIHJldHVybiByYWRpdXM7XHJcbiAgfVxyXG5cclxuICBzZWxmLnByb2dyZXNzID0gZDMuc3ZnLmFyYygpXHJcbiAgICAuc3RhcnRBbmdsZSgwKVxyXG4gICAgLmVuZEFuZ2xlKGZ1bmN0aW9uIChpdGVtKSB7XHJcbiAgICAgIHJldHVybiBpdGVtLnBlcmNlbnRhZ2UgLyAxMDAgKiDPhDtcclxuICAgIH0pXHJcbiAgICAuaW5uZXJSYWRpdXMoaW5uZXJSYWRpdXMpXHJcbiAgICAub3V0ZXJSYWRpdXMob3V0ZXJSYWRpdXMpXHJcbiAgICAuY29ybmVyUmFkaXVzKGZ1bmN0aW9uIChkKSB7XHJcbiAgICAgIC8vIFdvcmthcm91bmQgZm9yIGQzIGJ1ZyBodHRwczovL2dpdGh1Yi5jb20vbWJvc3RvY2svZDMvaXNzdWVzLzIyNDlcclxuICAgICAgLy8gUmVkdWNlIGNvcm5lciByYWRpdXMgd2hlbiBjb3JuZXJzIGFyZSBjbG9zZSBlYWNoIG90aGVyXHJcbiAgICAgIHZhciBtID0gZC5wZXJjZW50YWdlID49IDkwID8gKDEwMCAtIGQucGVyY2VudGFnZSkgKiAwLjEgOiAxO1xyXG4gICAgICByZXR1cm4gKHNlbGYub3B0aW9ucy5zdHJva2Uud2lkdGggLyAyKSAqIG07XHJcbiAgICB9KTtcclxuXHJcbiAgdmFyIGJhY2tncm91bmQgPSBkMy5zdmcuYXJjKClcclxuICAgIC5zdGFydEFuZ2xlKDApXHJcbiAgICAuZW5kQW5nbGUoz4QpXHJcbiAgICAuaW5uZXJSYWRpdXMoaW5uZXJSYWRpdXMpXHJcbiAgICAub3V0ZXJSYWRpdXMob3V0ZXJSYWRpdXMpO1xyXG5cclxuICAvLyBjcmVhdGUgc3ZnXHJcbiAgc2VsZi5zdmcgPSBkMy5zZWxlY3QocXVlcnkpLmFwcGVuZChcInN2Z1wiKVxyXG4gICAgLmF0dHIoXCJwcmVzZXJ2ZUFzcGVjdFJhdGlvXCIsXCJ4TWluWU1pbiBtZWV0XCIpXHJcbiAgICAuYXR0cihcInZpZXdCb3hcIiwgZGltKVxyXG4gICAgLmFwcGVuZChcImdcIilcclxuICAgIC5hdHRyKFwidHJhbnNmb3JtXCIsIFwidHJhbnNsYXRlKFwiICsgd2lkdGggLyAyICsgXCIsXCIgKyBoZWlnaHQgLyAyICsgXCIpXCIpO1xyXG5cclxuICAvLyBhZGQgZ3JhZGllbnRzIGRlZnNcclxuICB2YXIgZGVmcyA9IHNlbGYuc3ZnLmFwcGVuZChcInN2ZzpkZWZzXCIpO1xyXG4gIHNlcmllcy5mb3JFYWNoKGZ1bmN0aW9uIChpdGVtKSB7XHJcbiAgICBpZiAoaXRlbS5jb2xvci5saW5lYXJHcmFkaWVudCB8fCBpdGVtLmNvbG9yLnJhZGlhbEdyYWRpZW50KSB7XHJcbiAgICAgIHZhciBncmFkaWVudCA9IFJhZGlhbFByb2dyZXNzQ2hhcnQuR3JhZGllbnQudG9TVkdFbGVtZW50KCdncmFkaWVudCcgKyBpdGVtLmluZGV4LCBpdGVtLmNvbG9yKTtcclxuICAgICAgZGVmcy5ub2RlKCkuYXBwZW5kQ2hpbGQoZ3JhZGllbnQpO1xyXG4gICAgfVxyXG4gIH0pO1xyXG5cclxuICAvLyBhZGQgc2hhZG93cyBkZWZzXHJcbiAgZGVmcyA9IHNlbGYuc3ZnLmFwcGVuZChcInN2ZzpkZWZzXCIpO1xyXG4gIHZhciBkcm9wc2hhZG93SWQgPSBcImRyb3BzaGFkb3ctXCIgKyBNYXRoLnJhbmRvbSgpO1xyXG4gIHZhciBmaWx0ZXIgPSBkZWZzLmFwcGVuZChcImZpbHRlclwiKS5hdHRyKFwiaWRcIiwgZHJvcHNoYWRvd0lkKTtcclxuICBpZihzZWxmLm9wdGlvbnMuc2hhZG93LndpZHRoID4gMCkge1xyXG5cclxuICAgIGZpbHRlci5hcHBlbmQoXCJmZUdhdXNzaWFuQmx1clwiKVxyXG4gICAgICAuYXR0cihcImluXCIsIFwiU291cmNlQWxwaGFcIilcclxuICAgICAgLmF0dHIoXCJzdGREZXZpYXRpb25cIiwgc2VsZi5vcHRpb25zLnNoYWRvdy53aWR0aClcclxuICAgICAgLmF0dHIoXCJyZXN1bHRcIiwgXCJibHVyXCIpO1xyXG5cclxuICAgIGZpbHRlci5hcHBlbmQoXCJmZU9mZnNldFwiKVxyXG4gICAgICAuYXR0cihcImluXCIsIFwiYmx1clwiKVxyXG4gICAgICAuYXR0cihcImR4XCIsIDEpXHJcbiAgICAgIC5hdHRyKFwiZHlcIiwgMSlcclxuICAgICAgLmF0dHIoXCJyZXN1bHRcIiwgXCJvZmZzZXRCbHVyXCIpO1xyXG4gIH1cclxuXHJcbiAgdmFyIGZlTWVyZ2UgPSBmaWx0ZXIuYXBwZW5kKFwiZmVNZXJnZVwiKTtcclxuICBmZU1lcmdlLmFwcGVuZChcImZlTWVyZ2VOb2RlXCIpLmF0dHIoXCJpblwiLCBcIm9mZnNldEJsdXJcIik7XHJcbiAgZmVNZXJnZS5hcHBlbmQoXCJmZU1lcmdlTm9kZVwiKS5hdHRyKFwiaW5cIiwgXCJTb3VyY2VHcmFwaGljXCIpO1xyXG5cclxuICAvLyBhZGQgaW5uZXIgdGV4dFxyXG4gIGlmIChzZWxmLm9wdGlvbnMuY2VudGVyKSB7XHJcbiAgICBzZWxmLnN2Zy5hcHBlbmQoXCJ0ZXh0XCIpXHJcbiAgICAgIC5hdHRyKCdjbGFzcycsICdyYmMtY2VudGVyLXRleHQnKVxyXG4gICAgICAuYXR0cihcInRleHQtYW5jaG9yXCIsIFwibWlkZGxlXCIpXHJcbiAgICAgIC5hdHRyKCd4Jywgc2VsZi5vcHRpb25zLmNlbnRlci54ICsgJ3B4JylcclxuICAgICAgLmF0dHIoJ3knLCBzZWxmLm9wdGlvbnMuY2VudGVyLnkgKyAncHgnKVxyXG4gICAgICAuc2VsZWN0QWxsKCd0c3BhbicpXHJcbiAgICAgIC5kYXRhKHNlbGYub3B0aW9ucy5jZW50ZXIuY29udGVudCkuZW50ZXIoKVxyXG4gICAgICAuYXBwZW5kKCd0c3BhbicpXHJcbiAgICAgIC5hdHRyKFwiZG9taW5hbnQtYmFzZWxpbmVcIiwgZnVuY3Rpb24gKCkge1xyXG5cclxuICAgICAgICAvLyBTaW5nbGUgbGluZXMgY2FuIGVhc2lseSBjZW50ZXJlZCBpbiB0aGUgbWlkZGxlIHVzaW5nIGRvbWluYW50LWJhc2VsaW5lLCBtdWx0aWxpbmUgbmVlZCB0byB1c2UgeVxyXG4gICAgICAgIGlmIChzZWxmLm9wdGlvbnMuY2VudGVyLmNvbnRlbnQubGVuZ3RoID09PSAxKSB7XHJcbiAgICAgICAgICByZXR1cm4gJ2NlbnRyYWwnO1xyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuICAgICAgLmF0dHIoJ2NsYXNzJywgZnVuY3Rpb24gKGQsIGkpIHtcclxuICAgICAgICByZXR1cm4gJ3JiYy1jZW50ZXItdGV4dC1saW5lJyArIGk7XHJcbiAgICAgIH0pXHJcbiAgICAgIC5hdHRyKCd4JywgMClcclxuICAgICAgLmF0dHIoJ2R5JywgZnVuY3Rpb24gKGQsIGkpIHtcclxuICAgICAgICBpZiAoaSA+IDApIHtcclxuICAgICAgICAgIHJldHVybiAnMS4xZW0nO1xyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuICAgICAgLmVhY2goZnVuY3Rpb24gKGQpIHtcclxuICAgICAgICBpZiAodHlwZW9mIGQgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgIHRoaXMuY2FsbGJhY2sgPSBkO1xyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuICAgICAgLnRleHQoZnVuY3Rpb24gKGQpIHtcclxuICAgICAgICBpZiAodHlwZW9mIGQgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICByZXR1cm4gZDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiAnJztcclxuICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyBhZGQgcmluZyBzdHJ1Y3R1cmVcclxuICBzZWxmLmZpZWxkID0gc2VsZi5zdmcuc2VsZWN0QWxsKFwiZ1wiKVxyXG4gICAgLmRhdGEoc2VyaWVzKVxyXG4gICAgLmVudGVyKCkuYXBwZW5kKFwiZ1wiKTtcclxuXHJcbiAgc2VsZi5maWVsZC5hcHBlbmQoXCJwYXRoXCIpLmF0dHIoXCJjbGFzc1wiLCBcInByb2dyZXNzXCIpLmF0dHIoXCJmaWx0ZXJcIiwgXCJ1cmwoI1wiICsgZHJvcHNoYWRvd0lkICtcIilcIik7XHJcblxyXG4gIHNlbGYuZmllbGQuYXBwZW5kKFwicGF0aFwiKS5hdHRyKFwiY2xhc3NcIiwgXCJiZ1wiKVxyXG4gICAgLnN0eWxlKFwiZmlsbFwiLCBmdW5jdGlvbiAoaXRlbSkge1xyXG4gICAgICByZXR1cm4gaXRlbS5jb2xvci5iYWNrZ3JvdW5kO1xyXG4gICAgfSlcclxuICAgIC5zdHlsZShcIm9wYWNpdHlcIiwgMC4yKVxyXG4gICAgLmF0dHIoXCJkXCIsIGJhY2tncm91bmQpO1xyXG5cclxuICBzZWxmLmZpZWxkLmFwcGVuZChcInRleHRcIilcclxuICAgIC5jbGFzc2VkKCdyYmMtbGFiZWwgcmJjLWxhYmVsLXN0YXJ0JywgdHJ1ZSlcclxuICAgIC5hdHRyKFwiZG9taW5hbnQtYmFzZWxpbmVcIiwgXCJjZW50cmFsXCIpXHJcbiAgICAuYXR0cihcInhcIiwgXCIxMFwiKVxyXG4gICAgLmF0dHIoXCJ5XCIsIGZ1bmN0aW9uIChpdGVtKSB7XHJcbiAgICAgIHJldHVybiAtKFxyXG4gICAgICAgIHNlbGYub3B0aW9ucy5kaWFtZXRlciAvIDIgK1xyXG4gICAgICAgIGl0ZW0uaW5kZXggKiAoc2VsZi5vcHRpb25zLnN0cm9rZS5nYXAgKyBzZWxmLm9wdGlvbnMuc3Ryb2tlLndpZHRoKSArXHJcbiAgICAgICAgc2VsZi5vcHRpb25zLnN0cm9rZS53aWR0aCAvIDJcclxuICAgICAgICApO1xyXG4gICAgfSlcclxuICAgIC50ZXh0KGZ1bmN0aW9uIChpdGVtKSB7XHJcbiAgICAgIHJldHVybiBpdGVtLmxhYmVsU3RhcnQ7XHJcbiAgICB9KTtcclxuXHJcbiAgc2VsZi51cGRhdGUoKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFVwZGF0ZSBkYXRhIHRvIGJlIHZpc3VhbGl6ZWQgaW4gdGhlIGNoYXJ0LlxyXG4gKlxyXG4gKiBAcGFyYW0ge09iamVjdHxBcnJheX0gZGF0YSBPcHRpb25hbCBkYXRhIHlvdSdkIGxpa2UgdG8gc2V0IGZvciB0aGUgY2hhcnQgYmVmb3JlIGl0IHdpbGwgdXBkYXRlLiBJZiBub3Qgc3BlY2lmaWVkIHRoZSB1cGRhdGUgbWV0aG9kIHdpbGwgdXNlIHRoZSBkYXRhIHRoYXQgaXMgYWxyZWFkeSBjb25maWd1cmVkIHdpdGggdGhlIGNoYXJ0LlxyXG4gKiBAZXhhbXBsZSB1cGRhdGUoWzcwLCAxMCwgNDVdKVxyXG4gKiBAZXhhbXBsZSB1cGRhdGUoe3NlcmllczogW3t2YWx1ZTogNzB9LCAxMCwgNDVdfSlcclxuICpcclxuICovXHJcblJhZGlhbFByb2dyZXNzQ2hhcnQucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAvLyBwYXJzZSBuZXcgZGF0YVxyXG4gIGlmIChkYXRhKSB7XHJcbiAgICBpZiAodHlwZW9mIGRhdGEgPT09ICdudW1iZXInKSB7XHJcbiAgICAgIGRhdGEgPSBbZGF0YV07XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHNlcmllcztcclxuXHJcbiAgICBpZiAoQXJyYXkuaXNBcnJheShkYXRhKSkge1xyXG4gICAgICBzZXJpZXMgPSBkYXRhO1xyXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgZGF0YSA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgc2VyaWVzID0gZGF0YS5zZXJpZXMgfHwgW107XHJcbiAgICB9XHJcblxyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZXJpZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgdGhpcy5vcHRpb25zLnNlcmllc1tpXS5wcmV2aW91c1ZhbHVlID0gdGhpcy5vcHRpb25zLnNlcmllc1tpXS52YWx1ZTtcclxuXHJcbiAgICAgIHZhciBpdGVtID0gc2VyaWVzW2ldO1xyXG4gICAgICBpZiAodHlwZW9mIGl0ZW0gPT09ICdudW1iZXInKSB7XHJcbiAgICAgICAgdGhpcy5vcHRpb25zLnNlcmllc1tpXS52YWx1ZSA9IGl0ZW07XHJcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGl0ZW0gPT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgdGhpcy5vcHRpb25zLnNlcmllc1tpXS52YWx1ZSA9IGl0ZW0udmFsdWU7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIGNhbGN1bGF0ZSBmcm9tIHBlcmNlbnRhZ2UgYW5kIG5ldyBwZXJjZW50YWdlIGZvciB0aGUgcHJvZ3Jlc3MgYW5pbWF0aW9uXHJcbiAgc2VsZi5vcHRpb25zLnNlcmllcy5mb3JFYWNoKGZ1bmN0aW9uIChpdGVtKSB7XHJcbiAgICBpdGVtLmZyb21QZXJjZW50YWdlID0gaXRlbS5wZXJjZW50YWdlID8gaXRlbS5wZXJjZW50YWdlIDogNTtcclxuICAgIGl0ZW0ucGVyY2VudGFnZSA9IChpdGVtLnZhbHVlIC0gc2VsZi5vcHRpb25zLm1pbikgKiAxMDAgLyAoc2VsZi5vcHRpb25zLm1heCAtIHNlbGYub3B0aW9ucy5taW4pO1xyXG4gIH0pO1xyXG5cclxuICB2YXIgY2VudGVyID0gc2VsZi5zdmcuc2VsZWN0KFwidGV4dC5yYmMtY2VudGVyLXRleHRcIik7XHJcblxyXG4gIC8vIHByb2dyZXNzXHJcbiAgc2VsZi5maWVsZC5zZWxlY3QoXCJwYXRoLnByb2dyZXNzXCIpXHJcbiAgICAuaW50ZXJydXB0KClcclxuICAgIC50cmFuc2l0aW9uKClcclxuICAgIC5kdXJhdGlvbihzZWxmLm9wdGlvbnMuYW5pbWF0aW9uLmR1cmF0aW9uKVxyXG4gICAgLmRlbGF5KGZ1bmN0aW9uIChkLCBpKSB7XHJcbiAgICAgIC8vIGRlbGF5IGJldHdlZW4gZWFjaCBpdGVtXHJcbiAgICAgIHJldHVybiBpICogc2VsZi5vcHRpb25zLmFuaW1hdGlvbi5kZWxheTtcclxuICAgIH0pXHJcbiAgICAuZWFzZShcImVsYXN0aWNcIilcclxuICAgIC5hdHRyVHdlZW4oXCJkXCIsIGZ1bmN0aW9uIChpdGVtKSB7XHJcbiAgICAgIHZhciBpbnRlcnBvbGF0b3IgPSBkMy5pbnRlcnBvbGF0ZU51bWJlcihpdGVtLmZyb21QZXJjZW50YWdlLCBpdGVtLnBlcmNlbnRhZ2UpO1xyXG4gICAgICByZXR1cm4gZnVuY3Rpb24gKHQpIHtcclxuICAgICAgICBpdGVtLnBlcmNlbnRhZ2UgPSBpbnRlcnBvbGF0b3IodCk7XHJcbiAgICAgICAgcmV0dXJuIHNlbGYucHJvZ3Jlc3MoaXRlbSk7XHJcbiAgICAgIH07XHJcbiAgICB9KVxyXG4gICAgLnR3ZWVuKFwiY2VudGVyXCIsIGZ1bmN0aW9uIChpdGVtKSB7XHJcbiAgICAgIC8vIEV4ZWN1dGUgY2FsbGJhY2tzIG9uIGVhY2ggbGluZVxyXG4gICAgICBpZiAoc2VsZi5vcHRpb25zLmNlbnRlcikge1xyXG4gICAgICAgIHZhciBpbnRlcnBvbGF0ZSA9IHNlbGYub3B0aW9ucy5yb3VuZCA/IGQzLmludGVycG9sYXRlUm91bmQgOiBkMy5pbnRlcnBvbGF0ZU51bWJlcjtcclxuICAgICAgICB2YXIgaW50ZXJwb2xhdG9yID0gaW50ZXJwb2xhdGUoaXRlbS5wcmV2aW91c1ZhbHVlIHx8IDAsIGl0ZW0udmFsdWUpO1xyXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAodCkge1xyXG4gICAgICAgICAgY2VudGVyXHJcbiAgICAgICAgICAgIC5zZWxlY3RBbGwoJ3RzcGFuJylcclxuICAgICAgICAgICAgLmVhY2goZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgIGlmICh0aGlzLmNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgICAgICBkMy5zZWxlY3QodGhpcykudGV4dCh0aGlzLmNhbGxiYWNrKGludGVycG9sYXRvcih0KSwgaXRlbS5pbmRleCwgaXRlbSkpO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfTtcclxuICAgICAgfVxyXG4gICAgfSlcclxuICAgIC50d2VlbihcImludGVycG9sYXRlLWNvbG9yXCIsIGZ1bmN0aW9uIChpdGVtKSB7XHJcbiAgICAgIGlmIChpdGVtLmNvbG9yLmludGVycG9sYXRlICYmIGl0ZW0uY29sb3IuaW50ZXJwb2xhdGUubGVuZ3RoID09IDIpIHtcclxuICAgICAgICB2YXIgY29sb3JJbnRlcnBvbGF0b3IgPSBkMy5pbnRlcnBvbGF0ZUhzbChpdGVtLmNvbG9yLmludGVycG9sYXRlWzBdLCBpdGVtLmNvbG9yLmludGVycG9sYXRlWzFdKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICh0KSB7XHJcbiAgICAgICAgICB2YXIgY29sb3IgPSBjb2xvckludGVycG9sYXRvcihpdGVtLnBlcmNlbnRhZ2UgLyAxMDApO1xyXG4gICAgICAgICAgZDMuc2VsZWN0KHRoaXMpLnN0eWxlKCdmaWxsJywgY29sb3IpO1xyXG4gICAgICAgICAgZDMuc2VsZWN0KHRoaXMucGFyZW50Tm9kZSkuc2VsZWN0KCdwYXRoLmJnJykuc3R5bGUoJ2ZpbGwnLCBjb2xvcik7XHJcbiAgICAgICAgfTtcclxuICAgICAgfVxyXG4gICAgfSlcclxuICAgIC5zdHlsZShcImZpbGxcIiwgZnVuY3Rpb24gKGl0ZW0pIHtcclxuICAgICAgaWYgKGl0ZW0uY29sb3Iuc29saWQpIHtcclxuICAgICAgICByZXR1cm4gaXRlbS5jb2xvci5zb2xpZDtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKGl0ZW0uY29sb3IubGluZWFyR3JhZGllbnQgfHwgaXRlbS5jb2xvci5yYWRpYWxHcmFkaWVudCkge1xyXG4gICAgICAgIHJldHVybiBcInVybCgjZ3JhZGllbnRcIiArIGl0ZW0uaW5kZXggKyAnKSc7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFJlbW92ZSBzdmcgYW5kIGNsZWFuIHNvbWUgcmVmZXJlbmNlc1xyXG4gKi9cclxuUmFkaWFsUHJvZ3Jlc3NDaGFydC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcclxuICB0aGlzLnN2Zy5yZW1vdmUoKTtcclxuICBkZWxldGUgdGhpcy5zdmc7XHJcbn07XHJcblxyXG4vKipcclxuICogRGV0YWNoIGFuZCBub3JtYWxpemUgdXNlcidzIG9wdGlvbnMgaW5wdXQuXHJcbiAqL1xyXG5SYWRpYWxQcm9ncmVzc0NoYXJ0Lm5vcm1hbGl6ZU9wdGlvbnMgPSBmdW5jdGlvbiAob3B0aW9ucykge1xyXG4gIGlmICghb3B0aW9ucyB8fCB0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcpIHtcclxuICAgIG9wdGlvbnMgPSB7fTtcclxuICB9XHJcblxyXG4gIHZhciBfb3B0aW9ucyA9IHtcclxuICAgIGRpYW1ldGVyOiBvcHRpb25zLmRpYW1ldGVyIHx8IDEwMCxcclxuICAgIHN0cm9rZToge1xyXG4gICAgICB3aWR0aDogb3B0aW9ucy5zdHJva2UgJiYgb3B0aW9ucy5zdHJva2Uud2lkdGggfHwgNDAsXHJcbiAgICAgIGdhcDogKCFvcHRpb25zLnN0cm9rZSB8fCBvcHRpb25zLnN0cm9rZS5nYXAgPT09IHVuZGVmaW5lZCkgPyAyIDogb3B0aW9ucy5zdHJva2UuZ2FwXHJcbiAgICB9LFxyXG4gICAgc2hhZG93OiB7XHJcbiAgICAgIHdpZHRoOiAoIW9wdGlvbnMuc2hhZG93IHx8IG9wdGlvbnMuc2hhZG93LndpZHRoID09PSBudWxsKSA/IDQgOiBvcHRpb25zLnNoYWRvdy53aWR0aFxyXG4gICAgfSxcclxuICAgIGFuaW1hdGlvbjoge1xyXG4gICAgICBkdXJhdGlvbjogb3B0aW9ucy5hbmltYXRpb24gJiYgb3B0aW9ucy5hbmltYXRpb24uZHVyYXRpb24gfHwgMTc1MCxcclxuICAgICAgZGVsYXk6IG9wdGlvbnMuYW5pbWF0aW9uICYmIG9wdGlvbnMuYW5pbWF0aW9uLmRlbGF5IHx8IDIwMFxyXG4gICAgfSxcclxuICAgIG1pbjogb3B0aW9ucy5taW4gfHwgMCxcclxuICAgIG1heDogb3B0aW9ucy5tYXggfHwgMTAwLFxyXG4gICAgcm91bmQ6IG9wdGlvbnMucm91bmQgIT09IHVuZGVmaW5lZCA/ICEhb3B0aW9ucy5yb3VuZCA6IHRydWUsXHJcbiAgICBzZXJpZXM6IG9wdGlvbnMuc2VyaWVzIHx8IFtdLFxyXG4gICAgY2VudGVyOiBSYWRpYWxQcm9ncmVzc0NoYXJ0Lm5vcm1hbGl6ZUNlbnRlcihvcHRpb25zLmNlbnRlcilcclxuICB9O1xyXG5cclxuICB2YXIgZGVmYXVsdENvbG9yc0l0ZXJhdG9yID0gbmV3IFJhZGlhbFByb2dyZXNzQ2hhcnQuQ29sb3JzSXRlcmF0b3IoKTtcclxuICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gX29wdGlvbnMuc2VyaWVzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XHJcbiAgICB2YXIgaXRlbSA9IG9wdGlvbnMuc2VyaWVzW2ldO1xyXG5cclxuICAgIC8vIGNvbnZlcnQgbnVtYmVyIHRvIG9iamVjdFxyXG4gICAgaWYgKHR5cGVvZiBpdGVtID09PSAnbnVtYmVyJykge1xyXG4gICAgICBpdGVtID0ge3ZhbHVlOiBpdGVtfTtcclxuICAgIH1cclxuXHJcbiAgICBfb3B0aW9ucy5zZXJpZXNbaV0gPSB7XHJcbiAgICAgIGluZGV4OiBpLFxyXG4gICAgICB2YWx1ZTogaXRlbS52YWx1ZSxcclxuICAgICAgbGFiZWxTdGFydDogaXRlbS5sYWJlbFN0YXJ0LFxyXG4gICAgICBjb2xvcjogUmFkaWFsUHJvZ3Jlc3NDaGFydC5ub3JtYWxpemVDb2xvcihpdGVtLmNvbG9yLCBkZWZhdWx0Q29sb3JzSXRlcmF0b3IpXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIF9vcHRpb25zO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIE5vcm1hbGl6ZSBkaWZmZXJlbnQgbm90YXRpb25zIG9mIGNvbG9yIHByb3BlcnR5XHJcbiAqXHJcbiAqIEBwYXJhbSB7U3RyaW5nfEFycmF5fE9iamVjdH0gY29sb3JcclxuICogQGV4YW1wbGUgJyNmZTA4YjUnXHJcbiAqIEBleGFtcGxlIHsgc29saWQ6ICcjZmUwOGI1JywgYmFja2dyb3VuZDogJyMwMDAwMDAnIH1cclxuICogQGV4YW1wbGUgWycjMDAwMDAwJywgJyNmZjAwMDAnXVxyXG4gKiBAZXhhbXBsZSB7XHJcbiAgICAgICAgICAgICAgICBsaW5lYXJHcmFkaWVudDogeyB4MTogJzAlJywgeTE6ICcxMDAlJywgeDI6ICc1MCUnLCB5MjogJzAlJ30sXHJcbiAgICAgICAgICAgICAgICBzdG9wczogW1xyXG4gICAgICAgICAgICAgICAgICB7b2Zmc2V0OiAnMCUnLCAnc3RvcC1jb2xvcic6ICcjZmUwOGI1JywgJ3N0b3Atb3BhY2l0eSc6IDF9LFxyXG4gICAgICAgICAgICAgICAgICB7b2Zmc2V0OiAnMTAwJScsICdzdG9wLWNvbG9yJzogJyNmZjE0MTAnLCAnc3RvcC1vcGFjaXR5JzogMX1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICB9XHJcbiAqIEBleGFtcGxlIHtcclxuICAgICAgICAgICAgICAgIHJhZGlhbEdyYWRpZW50OiB7Y3g6ICc2MCcsIGN5OiAnNjAnLCByOiAnNTAnfSxcclxuICAgICAgICAgICAgICAgIHN0b3BzOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtvZmZzZXQ6ICcwJScsICdzdG9wLWNvbG9yJzogJyNmZTA4YjUnLCAnc3RvcC1vcGFjaXR5JzogMX0sXHJcbiAgICAgICAgICAgICAgICAgIHtvZmZzZXQ6ICcxMDAlJywgJ3N0b3AtY29sb3InOiAnI2ZmMTQxMCcsICdzdG9wLW9wYWNpdHknOiAxfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH1cclxuICpcclxuICovXHJcblJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplQ29sb3IgPSBmdW5jdGlvbiAoY29sb3IsIGRlZmF1bHRDb2xvcnNJdGVyYXRvcikge1xyXG5cclxuICBpZiAoIWNvbG9yKSB7XHJcbiAgICBjb2xvciA9IHtzb2xpZDogZGVmYXVsdENvbG9yc0l0ZXJhdG9yLm5leHQoKX07XHJcbiAgfSBlbHNlIGlmICh0eXBlb2YgY29sb3IgPT09ICdzdHJpbmcnKSB7XHJcbiAgICBjb2xvciA9IHtzb2xpZDogY29sb3J9O1xyXG4gIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShjb2xvcikpIHtcclxuICAgIGNvbG9yID0ge2ludGVycG9sYXRlOiBjb2xvcn07XHJcbiAgfSBlbHNlIGlmICh0eXBlb2YgY29sb3IgPT09ICdvYmplY3QnKSB7XHJcbiAgICBpZiAoIWNvbG9yLnNvbGlkICYmICFjb2xvci5pbnRlcnBvbGF0ZSAmJiAhY29sb3IubGluZWFyR3JhZGllbnQgJiYgIWNvbG9yLnJhZGlhbEdyYWRpZW50KSB7XHJcbiAgICAgIGNvbG9yLnNvbGlkID0gZGVmYXVsdENvbG9yc0l0ZXJhdG9yLm5leHQoKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIFZhbGlkYXRlIGludGVycG9sYXRlIHN5bnRheFxyXG4gIGlmIChjb2xvci5pbnRlcnBvbGF0ZSkge1xyXG4gICAgaWYgKGNvbG9yLmludGVycG9sYXRlLmxlbmd0aCAhPT0gMikge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludGVycG9sYXRlIGFycmF5IHNob3VsZCBjb250YWluIHR3byBjb2xvcnMnKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIFZhbGlkYXRlIGdyYWRpZW50IHN5bnRheFxyXG4gIGlmIChjb2xvci5saW5lYXJHcmFkaWVudCB8fCBjb2xvci5yYWRpYWxHcmFkaWVudCkge1xyXG4gICAgaWYgKCFjb2xvci5zdG9wcyB8fCAhQXJyYXkuaXNBcnJheShjb2xvci5zdG9wcykgfHwgY29sb3Iuc3RvcHMubGVuZ3RoICE9PSAyKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignZ3JhZGllbnQgc3ludGF4IGlzIG1hbGZvcm1lZCcpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gU2V0IGJhY2tncm91bmQgd2hlbiBpcyBub3QgcHJvdmlkZWRcclxuICBpZiAoIWNvbG9yLmJhY2tncm91bmQpIHtcclxuICAgIGlmIChjb2xvci5zb2xpZCkge1xyXG4gICAgICBjb2xvci5iYWNrZ3JvdW5kID0gY29sb3Iuc29saWQ7XHJcbiAgICB9IGVsc2UgaWYgKGNvbG9yLmludGVycG9sYXRlKSB7XHJcbiAgICAgIGNvbG9yLmJhY2tncm91bmQgPSBjb2xvci5pbnRlcnBvbGF0ZVswXTtcclxuICAgIH0gZWxzZSBpZiAoY29sb3IubGluZWFyR3JhZGllbnQgfHwgY29sb3IucmFkaWFsR3JhZGllbnQpIHtcclxuICAgICAgY29sb3IuYmFja2dyb3VuZCA9IGNvbG9yLnN0b3BzWzBdWydzdG9wLWNvbG9yJ107XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4gY29sb3I7XHJcblxyXG59O1xyXG5cclxuXHJcbi8qKlxyXG4gKiBOb3JtYWxpemUgZGlmZmVyZW50IG5vdGF0aW9ucyBvZiBjZW50ZXIgcHJvcGVydHlcclxuICpcclxuICogQHBhcmFtIHtTdHJpbmd8QXJyYXl8RnVuY3Rpb258T2JqZWN0fSBjZW50ZXJcclxuICogQGV4YW1wbGUgJ2ZvbyBiYXInXHJcbiAqIEBleGFtcGxlIHsgY29udGVudDogJ2ZvbyBiYXInLCB4OiAxMCwgeTogNCB9XHJcbiAqIEBleGFtcGxlIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgaXRlbSkge31cclxuICogQGV4YW1wbGUgWydmb28gYmFyJywgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBpdGVtKSB7fV1cclxuICovXHJcblJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplQ2VudGVyID0gZnVuY3Rpb24gKGNlbnRlcikge1xyXG4gIGlmICghY2VudGVyKSByZXR1cm4gbnVsbDtcclxuXHJcbiAgLy8gQ29udmVydCB0byBvYmplY3Qgbm90YXRpb25cclxuICBpZiAoY2VudGVyLmNvbnN0cnVjdG9yICE9PSBPYmplY3QpIHtcclxuICAgIGNlbnRlciA9IHtjb250ZW50OiBjZW50ZXJ9O1xyXG4gIH1cclxuXHJcbiAgLy8gRGVmYXVsdHNcclxuICBjZW50ZXIuY29udGVudCA9IGNlbnRlci5jb250ZW50IHx8IFtdO1xyXG4gIGNlbnRlci54ID0gY2VudGVyLnggfHwgMDtcclxuICBjZW50ZXIueSA9IGNlbnRlci55IHx8IDA7XHJcblxyXG4gIC8vIENvbnZlcnQgY29udGVudCB0byBhcnJheSBub3RhdGlvblxyXG4gIGlmICghQXJyYXkuaXNBcnJheShjZW50ZXIuY29udGVudCkpIHtcclxuICAgIGNlbnRlci5jb250ZW50ID0gW2NlbnRlci5jb250ZW50XTtcclxuICB9XHJcblxyXG4gIHJldHVybiBjZW50ZXI7XHJcbn07XHJcblxyXG4vLyBMaW5lYXIgb3IgUmFkaWFsIEdyYWRpZW50IGludGVybmFsIG9iamVjdFxyXG5SYWRpYWxQcm9ncmVzc0NoYXJ0LkdyYWRpZW50ID0gKGZ1bmN0aW9uICgpIHtcclxuICBmdW5jdGlvbiBHcmFkaWVudCgpIHtcclxuICB9XHJcblxyXG4gIEdyYWRpZW50LnRvU1ZHRWxlbWVudCA9IGZ1bmN0aW9uIChpZCwgb3B0aW9ucykge1xyXG4gICAgdmFyIGdyYWRpZW50VHlwZSA9IG9wdGlvbnMubGluZWFyR3JhZGllbnQgPyAnbGluZWFyR3JhZGllbnQnIDogJ3JhZGlhbEdyYWRpZW50JztcclxuICAgIHZhciBncmFkaWVudCA9IGQzLnNlbGVjdChkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoZDMubnMucHJlZml4LnN2ZywgZ3JhZGllbnRUeXBlKSlcclxuICAgICAgLmF0dHIob3B0aW9uc1tncmFkaWVudFR5cGVdKVxyXG4gICAgICAuYXR0cignaWQnLCBpZCk7XHJcblxyXG4gICAgb3B0aW9ucy5zdG9wcy5mb3JFYWNoKGZ1bmN0aW9uIChzdG9wQXR0cnMpIHtcclxuICAgICAgZ3JhZGllbnQuYXBwZW5kKFwic3ZnOnN0b3BcIikuYXR0cihzdG9wQXR0cnMpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5iYWNrZ3JvdW5kID0gb3B0aW9ucy5zdG9wc1swXVsnc3RvcC1jb2xvciddO1xyXG5cclxuICAgIHJldHVybiBncmFkaWVudC5ub2RlKCk7XHJcbiAgfTtcclxuXHJcbiAgcmV0dXJuIEdyYWRpZW50O1xyXG59KSgpO1xyXG5cclxuLy8gRGVmYXVsdCBjb2xvcnMgaXRlcmF0b3JcclxuUmFkaWFsUHJvZ3Jlc3NDaGFydC5Db2xvcnNJdGVyYXRvciA9IChmdW5jdGlvbiAoKSB7XHJcblxyXG4gIENvbG9yc0l0ZXJhdG9yLkRFRkFVTFRfQ09MT1JTID0gW1wiIzFhZDVkZVwiLCBcIiNhMGZmMDNcIiwgXCIjZTkwYjNhXCIsICcjZmY5NTAwJywgJyMwMDdhZmYnLCAnI2ZmY2MwMCcsICcjNTg1NmQ2JywgJyM4ZThlOTMnXTtcclxuXHJcbiAgZnVuY3Rpb24gQ29sb3JzSXRlcmF0b3IoKSB7XHJcbiAgICB0aGlzLmluZGV4ID0gMDtcclxuICB9XHJcblxyXG4gIENvbG9yc0l0ZXJhdG9yLnByb3RvdHlwZS5uZXh0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgaWYgKHRoaXMuaW5kZXggPT09IENvbG9yc0l0ZXJhdG9yLkRFRkFVTFRfQ09MT1JTLmxlbmd0aCkge1xyXG4gICAgICB0aGlzLmluZGV4ID0gMDtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gQ29sb3JzSXRlcmF0b3IuREVGQVVMVF9DT0xPUlNbdGhpcy5pbmRleCsrXTtcclxuICB9O1xyXG5cclxuICByZXR1cm4gQ29sb3JzSXRlcmF0b3I7XHJcbn0pKCk7XHJcblxyXG5cclxuLy8gRXhwb3J0IFJhZGlhbFByb2dyZXNzQ2hhcnQgb2JqZWN0XHJcbmlmICh0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiKW1vZHVsZS5leHBvcnRzID0gUmFkaWFsUHJvZ3Jlc3NDaGFydDtcclxuIl19
