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
      var m = d.percentage > 92 ? (100 - d.percentage) * 0.1 : 1;
      return (self.options.stroke.width / 2) * m;
    });

  var background = d3.svg.arc()
    .startAngle(0)
    .endAngle(τ)
    .innerRadius(innerRadius)
    .outerRadius(outerRadius);

  // create svg
  self.svg = d3.select(query).append("svg")
    .attr("width", width)
    .attr("height", height)
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

  var filter = defs.append("filter").attr("id", "dropshadow");
  filter.append("feGaussianBlur")
    .attr("in", "SourceAlpha")
    .attr("stdDeviation", 4)
    .attr("result", "blur");

  filter.append("feOffset")
    .attr("in", "blur")
    .attr("dx", 1)
    .attr("dy", 1)
    .attr("result", "offsetBlur");

  var feMerge = filter.append("feMerge");
  feMerge.append("feMergeNode").attr("in", "offsetBlur");
  feMerge.append("feMergeNode").attr("in", "SourceGraphic");

  // add inner text
  if (self.options.center) {
    self.svg.append("text")
      .attr('class', 'rbc-center-text')
      .attr("text-anchor", "middle")
      .attr('x', self.options.center.x)
      .attr('y', self.options.center.y)
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

  self.field.append("path").attr("class", "progress").attr("filter", "url(#dropshadow)");

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
      gap: options.stroke && options.stroke.gap || 2
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbnZhciBkMztcblxuLy8gUmFkaWFsUHJvZ3Jlc3NDaGFydCBvYmplY3RcbmZ1bmN0aW9uIFJhZGlhbFByb2dyZXNzQ2hhcnQocXVlcnksIG9wdGlvbnMpIHtcblxuICAvLyB2ZXJpZnkgZDMgaXMgbG9hZGVkXG4gIGQzID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5kMykgPyB3aW5kb3cuZDMgOiB0eXBlb2YgcmVxdWlyZSAhPT0gJ3VuZGVmaW5lZCcgPyByZXF1aXJlKFwiZDNcIikgOiB1bmRlZmluZWQ7XG4gIGlmKCFkMykgdGhyb3cgbmV3IEVycm9yKCdkMyBvYmplY3QgaXMgbWlzc2luZy4gRDMuanMgbGlicmFyeSBoYXMgdG8gYmUgbG9hZGVkIGJlZm9yZS4nKTtcblxuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYub3B0aW9ucyA9IFJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplT3B0aW9ucyhvcHRpb25zKTtcblxuICAvLyBpbnRlcm5hbCAgdmFyaWFibGVzXG4gIHZhciBzZXJpZXMgPSBzZWxmLm9wdGlvbnMuc2VyaWVzXG4gICAgLCB3aWR0aCA9IDE1ICsgKChzZWxmLm9wdGlvbnMuZGlhbWV0ZXIgLyAyKSArIChzZWxmLm9wdGlvbnMuc3Ryb2tlLndpZHRoICogc2VsZi5vcHRpb25zLnNlcmllcy5sZW5ndGgpICsgKHNlbGYub3B0aW9ucy5zdHJva2UuZ2FwICogc2VsZi5vcHRpb25zLnNlcmllcy5sZW5ndGggLSAxKSkgKiAyXG4gICAgLCBoZWlnaHQgPSB3aWR0aFxuICAgICwgz4QgPSAyICogTWF0aC5QSVxuICAgICwgaW5uZXIgPSBbXVxuICAgICwgb3V0ZXIgPSBbXTtcblxuICBmdW5jdGlvbiBpbm5lclJhZGl1cyhpdGVtKSB7XG4gICAgdmFyIHJhZGl1cyA9IGlubmVyW2l0ZW0uaW5kZXhdO1xuICAgIGlmIChyYWRpdXMpIHJldHVybiByYWRpdXM7XG5cbiAgICAvLyBmaXJzdCByaW5nIGJhc2VkIG9uIGRpYW1ldGVyIGFuZCB0aGUgcmVzdCBiYXNlZCBvbiB0aGUgcHJldmlvdXMgb3V0ZXIgcmFkaXVzIHBsdXMgZ2FwXG4gICAgcmFkaXVzID0gaXRlbS5pbmRleCA9PT0gMCA/IHNlbGYub3B0aW9ucy5kaWFtZXRlciAvIDIgOiBvdXRlcltpdGVtLmluZGV4IC0gMV0gKyBzZWxmLm9wdGlvbnMuc3Ryb2tlLmdhcDtcbiAgICBpbm5lcltpdGVtLmluZGV4XSA9IHJhZGl1cztcbiAgICByZXR1cm4gcmFkaXVzO1xuICB9XG5cbiAgZnVuY3Rpb24gb3V0ZXJSYWRpdXMoaXRlbSkge1xuICAgIHZhciByYWRpdXMgPSBvdXRlcltpdGVtLmluZGV4XTtcbiAgICBpZiAocmFkaXVzKSByZXR1cm4gcmFkaXVzO1xuXG4gICAgLy8gYmFzZWQgb24gdGhlIHByZXZpb3VzIGlubmVyIHJhZGl1cyArIHN0cm9rZSB3aWR0aFxuICAgIHJhZGl1cyA9IGlubmVyW2l0ZW0uaW5kZXhdICsgc2VsZi5vcHRpb25zLnN0cm9rZS53aWR0aDtcbiAgICBvdXRlcltpdGVtLmluZGV4XSA9IHJhZGl1cztcbiAgICByZXR1cm4gcmFkaXVzO1xuICB9XG5cbiAgc2VsZi5wcm9ncmVzcyA9IGQzLnN2Zy5hcmMoKVxuICAgIC5zdGFydEFuZ2xlKDApXG4gICAgLmVuZEFuZ2xlKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICByZXR1cm4gaXRlbS5wZXJjZW50YWdlIC8gMTAwICogz4Q7XG4gICAgfSlcbiAgICAuaW5uZXJSYWRpdXMoaW5uZXJSYWRpdXMpXG4gICAgLm91dGVyUmFkaXVzKG91dGVyUmFkaXVzKVxuICAgIC5jb3JuZXJSYWRpdXMoZnVuY3Rpb24gKGQpIHtcbiAgICAgIC8vIFdvcmthcm91bmQgZm9yIGQzIGJ1ZyBodHRwczovL2dpdGh1Yi5jb20vbWJvc3RvY2svZDMvaXNzdWVzLzIyNDlcbiAgICAgIC8vIFJlZHVjZSBjb3JuZXIgcmFkaXVzIHdoZW4gY29ybmVycyBhcmUgY2xvc2UgZWFjaCBvdGhlclxuICAgICAgdmFyIG0gPSBkLnBlcmNlbnRhZ2UgPiA5MiA/ICgxMDAgLSBkLnBlcmNlbnRhZ2UpICogMC4xIDogMTtcbiAgICAgIHJldHVybiAoc2VsZi5vcHRpb25zLnN0cm9rZS53aWR0aCAvIDIpICogbTtcbiAgICB9KTtcblxuICB2YXIgYmFja2dyb3VuZCA9IGQzLnN2Zy5hcmMoKVxuICAgIC5zdGFydEFuZ2xlKDApXG4gICAgLmVuZEFuZ2xlKM+EKVxuICAgIC5pbm5lclJhZGl1cyhpbm5lclJhZGl1cylcbiAgICAub3V0ZXJSYWRpdXMob3V0ZXJSYWRpdXMpO1xuXG4gIC8vIGNyZWF0ZSBzdmdcbiAgc2VsZi5zdmcgPSBkMy5zZWxlY3QocXVlcnkpLmFwcGVuZChcInN2Z1wiKVxuICAgIC5hdHRyKFwid2lkdGhcIiwgd2lkdGgpXG4gICAgLmF0dHIoXCJoZWlnaHRcIiwgaGVpZ2h0KVxuICAgIC5hcHBlbmQoXCJnXCIpXG4gICAgLmF0dHIoXCJ0cmFuc2Zvcm1cIiwgXCJ0cmFuc2xhdGUoXCIgKyB3aWR0aCAvIDIgKyBcIixcIiArIGhlaWdodCAvIDIgKyBcIilcIik7XG5cbiAgLy8gYWRkIGdyYWRpZW50cyBkZWZzXG4gIHZhciBkZWZzID0gc2VsZi5zdmcuYXBwZW5kKFwic3ZnOmRlZnNcIik7XG4gIHNlcmllcy5mb3JFYWNoKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgaWYgKGl0ZW0uY29sb3IubGluZWFyR3JhZGllbnQgfHwgaXRlbS5jb2xvci5yYWRpYWxHcmFkaWVudCkge1xuICAgICAgdmFyIGdyYWRpZW50ID0gUmFkaWFsUHJvZ3Jlc3NDaGFydC5HcmFkaWVudC50b1NWR0VsZW1lbnQoJ2dyYWRpZW50JyArIGl0ZW0uaW5kZXgsIGl0ZW0uY29sb3IpO1xuICAgICAgZGVmcy5ub2RlKCkuYXBwZW5kQ2hpbGQoZ3JhZGllbnQpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gYWRkIHNoYWRvd3MgZGVmc1xuICBkZWZzID0gc2VsZi5zdmcuYXBwZW5kKFwic3ZnOmRlZnNcIik7XG5cbiAgdmFyIGZpbHRlciA9IGRlZnMuYXBwZW5kKFwiZmlsdGVyXCIpLmF0dHIoXCJpZFwiLCBcImRyb3BzaGFkb3dcIik7XG4gIGZpbHRlci5hcHBlbmQoXCJmZUdhdXNzaWFuQmx1clwiKVxuICAgIC5hdHRyKFwiaW5cIiwgXCJTb3VyY2VBbHBoYVwiKVxuICAgIC5hdHRyKFwic3RkRGV2aWF0aW9uXCIsIDQpXG4gICAgLmF0dHIoXCJyZXN1bHRcIiwgXCJibHVyXCIpO1xuXG4gIGZpbHRlci5hcHBlbmQoXCJmZU9mZnNldFwiKVxuICAgIC5hdHRyKFwiaW5cIiwgXCJibHVyXCIpXG4gICAgLmF0dHIoXCJkeFwiLCAxKVxuICAgIC5hdHRyKFwiZHlcIiwgMSlcbiAgICAuYXR0cihcInJlc3VsdFwiLCBcIm9mZnNldEJsdXJcIik7XG5cbiAgdmFyIGZlTWVyZ2UgPSBmaWx0ZXIuYXBwZW5kKFwiZmVNZXJnZVwiKTtcbiAgZmVNZXJnZS5hcHBlbmQoXCJmZU1lcmdlTm9kZVwiKS5hdHRyKFwiaW5cIiwgXCJvZmZzZXRCbHVyXCIpO1xuICBmZU1lcmdlLmFwcGVuZChcImZlTWVyZ2VOb2RlXCIpLmF0dHIoXCJpblwiLCBcIlNvdXJjZUdyYXBoaWNcIik7XG5cbiAgLy8gYWRkIGlubmVyIHRleHRcbiAgaWYgKHNlbGYub3B0aW9ucy5jZW50ZXIpIHtcbiAgICBzZWxmLnN2Zy5hcHBlbmQoXCJ0ZXh0XCIpXG4gICAgICAuYXR0cignY2xhc3MnLCAncmJjLWNlbnRlci10ZXh0JylcbiAgICAgIC5hdHRyKFwidGV4dC1hbmNob3JcIiwgXCJtaWRkbGVcIilcbiAgICAgIC5hdHRyKCd4Jywgc2VsZi5vcHRpb25zLmNlbnRlci54KVxuICAgICAgLmF0dHIoJ3knLCBzZWxmLm9wdGlvbnMuY2VudGVyLnkpXG4gICAgICAuc2VsZWN0QWxsKCd0c3BhbicpXG4gICAgICAuZGF0YShzZWxmLm9wdGlvbnMuY2VudGVyLmNvbnRlbnQpLmVudGVyKClcbiAgICAgIC5hcHBlbmQoJ3RzcGFuJylcbiAgICAgIC5hdHRyKFwiZG9taW5hbnQtYmFzZWxpbmVcIiwgZnVuY3Rpb24gKCkge1xuXG4gICAgICAgIC8vIFNpbmdsZSBsaW5lcyBjYW4gZWFzaWx5IGNlbnRlcmVkIGluIHRoZSBtaWRkbGUgdXNpbmcgZG9taW5hbnQtYmFzZWxpbmUsIG11bHRpbGluZSBuZWVkIHRvIHVzZSB5XG4gICAgICAgIGlmIChzZWxmLm9wdGlvbnMuY2VudGVyLmNvbnRlbnQubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgcmV0dXJuICdjZW50cmFsJztcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC5hdHRyKCdjbGFzcycsIGZ1bmN0aW9uIChkLCBpKSB7XG4gICAgICAgIHJldHVybiAncmJjLWNlbnRlci10ZXh0LWxpbmUnICsgaTtcbiAgICAgIH0pXG4gICAgICAuYXR0cigneCcsIDApXG4gICAgICAuYXR0cignZHknLCBmdW5jdGlvbiAoZCwgaSkge1xuICAgICAgICBpZiAoaSA+IDApIHtcbiAgICAgICAgICByZXR1cm4gJzEuMWVtJztcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC5lYWNoKGZ1bmN0aW9uIChkKSB7XG4gICAgICAgIGlmICh0eXBlb2YgZCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHRoaXMuY2FsbGJhY2sgPSBkO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLnRleHQoZnVuY3Rpb24gKGQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBkID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIHJldHVybiBkO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuICcnO1xuICAgICAgfSk7XG4gIH1cblxuICAvLyBhZGQgcmluZyBzdHJ1Y3R1cmVcbiAgc2VsZi5maWVsZCA9IHNlbGYuc3ZnLnNlbGVjdEFsbChcImdcIilcbiAgICAuZGF0YShzZXJpZXMpXG4gICAgLmVudGVyKCkuYXBwZW5kKFwiZ1wiKTtcblxuICBzZWxmLmZpZWxkLmFwcGVuZChcInBhdGhcIikuYXR0cihcImNsYXNzXCIsIFwicHJvZ3Jlc3NcIikuYXR0cihcImZpbHRlclwiLCBcInVybCgjZHJvcHNoYWRvdylcIik7XG5cbiAgc2VsZi5maWVsZC5hcHBlbmQoXCJwYXRoXCIpLmF0dHIoXCJjbGFzc1wiLCBcImJnXCIpXG4gICAgLnN0eWxlKFwiZmlsbFwiLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgcmV0dXJuIGl0ZW0uY29sb3IuYmFja2dyb3VuZDtcbiAgICB9KVxuICAgIC5zdHlsZShcIm9wYWNpdHlcIiwgMC4yKVxuICAgIC5hdHRyKFwiZFwiLCBiYWNrZ3JvdW5kKTtcblxuICBzZWxmLmZpZWxkLmFwcGVuZChcInRleHRcIilcbiAgICAuY2xhc3NlZCgncmJjLWxhYmVsIHJiYy1sYWJlbC1zdGFydCcsIHRydWUpXG4gICAgLmF0dHIoXCJkb21pbmFudC1iYXNlbGluZVwiLCBcImNlbnRyYWxcIilcbiAgICAuYXR0cihcInhcIiwgXCIxMFwiKVxuICAgIC5hdHRyKFwieVwiLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgcmV0dXJuIC0oXG4gICAgICAgIHNlbGYub3B0aW9ucy5kaWFtZXRlciAvIDIgK1xuICAgICAgICBpdGVtLmluZGV4ICogKHNlbGYub3B0aW9ucy5zdHJva2UuZ2FwICsgc2VsZi5vcHRpb25zLnN0cm9rZS53aWR0aCkgK1xuICAgICAgICBzZWxmLm9wdGlvbnMuc3Ryb2tlLndpZHRoIC8gMlxuICAgICAgICApO1xuICAgIH0pXG4gICAgLnRleHQoZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgIHJldHVybiBpdGVtLmxhYmVsU3RhcnQ7XG4gICAgfSk7XG5cbiAgc2VsZi51cGRhdGUoKTtcbn1cblxuLyoqXG4gKiBVcGRhdGUgZGF0YSB0byBiZSB2aXN1YWxpemVkIGluIHRoZSBjaGFydC5cbiAqXG4gKiBAcGFyYW0ge09iamVjdHxBcnJheX0gZGF0YSBPcHRpb25hbCBkYXRhIHlvdSdkIGxpa2UgdG8gc2V0IGZvciB0aGUgY2hhcnQgYmVmb3JlIGl0IHdpbGwgdXBkYXRlLiBJZiBub3Qgc3BlY2lmaWVkIHRoZSB1cGRhdGUgbWV0aG9kIHdpbGwgdXNlIHRoZSBkYXRhIHRoYXQgaXMgYWxyZWFkeSBjb25maWd1cmVkIHdpdGggdGhlIGNoYXJ0LlxuICogQGV4YW1wbGUgdXBkYXRlKFs3MCwgMTAsIDQ1XSlcbiAqIEBleGFtcGxlIHVwZGF0ZSh7c2VyaWVzOiBbe3ZhbHVlOiA3MH0sIDEwLCA0NV19KVxuICpcbiAqL1xuUmFkaWFsUHJvZ3Jlc3NDaGFydC5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24gKGRhdGEpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIC8vIHBhcnNlIG5ldyBkYXRhXG4gIGlmIChkYXRhKSB7XG4gICAgaWYgKHR5cGVvZiBkYXRhID09PSAnbnVtYmVyJykge1xuICAgICAgZGF0YSA9IFtkYXRhXTtcbiAgICB9XG5cbiAgICB2YXIgc2VyaWVzO1xuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkoZGF0YSkpIHtcbiAgICAgIHNlcmllcyA9IGRhdGE7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgZGF0YSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIHNlcmllcyA9IGRhdGEuc2VyaWVzIHx8IFtdO1xuICAgIH1cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2VyaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGlzLm9wdGlvbnMuc2VyaWVzW2ldLnByZXZpb3VzVmFsdWUgPSB0aGlzLm9wdGlvbnMuc2VyaWVzW2ldLnZhbHVlO1xuXG4gICAgICB2YXIgaXRlbSA9IHNlcmllc1tpXTtcbiAgICAgIGlmICh0eXBlb2YgaXRlbSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgdGhpcy5vcHRpb25zLnNlcmllc1tpXS52YWx1ZSA9IGl0ZW07XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBpdGVtID09PSAnb2JqZWN0Jykge1xuICAgICAgICB0aGlzLm9wdGlvbnMuc2VyaWVzW2ldLnZhbHVlID0gaXRlbS52YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBjYWxjdWxhdGUgZnJvbSBwZXJjZW50YWdlIGFuZCBuZXcgcGVyY2VudGFnZSBmb3IgdGhlIHByb2dyZXNzIGFuaW1hdGlvblxuICBzZWxmLm9wdGlvbnMuc2VyaWVzLmZvckVhY2goZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICBpdGVtLmZyb21QZXJjZW50YWdlID0gaXRlbS5wZXJjZW50YWdlID8gaXRlbS5wZXJjZW50YWdlIDogNTtcbiAgICBpdGVtLnBlcmNlbnRhZ2UgPSAoaXRlbS52YWx1ZSAtIHNlbGYub3B0aW9ucy5taW4pICogMTAwIC8gKHNlbGYub3B0aW9ucy5tYXggLSBzZWxmLm9wdGlvbnMubWluKTtcbiAgfSk7XG5cbiAgdmFyIGNlbnRlciA9IHNlbGYuc3ZnLnNlbGVjdChcInRleHQucmJjLWNlbnRlci10ZXh0XCIpO1xuXG4gIC8vIHByb2dyZXNzXG4gIHNlbGYuZmllbGQuc2VsZWN0KFwicGF0aC5wcm9ncmVzc1wiKVxuICAgIC5pbnRlcnJ1cHQoKVxuICAgIC50cmFuc2l0aW9uKClcbiAgICAuZHVyYXRpb24oc2VsZi5vcHRpb25zLmFuaW1hdGlvbi5kdXJhdGlvbilcbiAgICAuZGVsYXkoZnVuY3Rpb24gKGQsIGkpIHtcbiAgICAgIC8vIGRlbGF5IGJldHdlZW4gZWFjaCBpdGVtXG4gICAgICByZXR1cm4gaSAqIHNlbGYub3B0aW9ucy5hbmltYXRpb24uZGVsYXk7XG4gICAgfSlcbiAgICAuZWFzZShcImVsYXN0aWNcIilcbiAgICAuYXR0clR3ZWVuKFwiZFwiLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgdmFyIGludGVycG9sYXRvciA9IGQzLmludGVycG9sYXRlTnVtYmVyKGl0ZW0uZnJvbVBlcmNlbnRhZ2UsIGl0ZW0ucGVyY2VudGFnZSk7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKHQpIHtcbiAgICAgICAgaXRlbS5wZXJjZW50YWdlID0gaW50ZXJwb2xhdG9yKHQpO1xuICAgICAgICByZXR1cm4gc2VsZi5wcm9ncmVzcyhpdGVtKTtcbiAgICAgIH07XG4gICAgfSlcbiAgICAudHdlZW4oXCJjZW50ZXJcIiwgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgIC8vIEV4ZWN1dGUgY2FsbGJhY2tzIG9uIGVhY2ggbGluZVxuICAgICAgaWYgKHNlbGYub3B0aW9ucy5jZW50ZXIpIHtcbiAgICAgICAgdmFyIGludGVycG9sYXRlID0gc2VsZi5vcHRpb25zLnJvdW5kID8gZDMuaW50ZXJwb2xhdGVSb3VuZCA6IGQzLmludGVycG9sYXRlTnVtYmVyO1xuICAgICAgICB2YXIgaW50ZXJwb2xhdG9yID0gaW50ZXJwb2xhdGUoaXRlbS5wcmV2aW91c1ZhbHVlIHx8IDAsIGl0ZW0udmFsdWUpO1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHQpIHtcbiAgICAgICAgICBjZW50ZXJcbiAgICAgICAgICAgIC5zZWxlY3RBbGwoJ3RzcGFuJylcbiAgICAgICAgICAgIC5lYWNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgaWYgKHRoaXMuY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBkMy5zZWxlY3QodGhpcykudGV4dCh0aGlzLmNhbGxiYWNrKGludGVycG9sYXRvcih0KSwgaXRlbS5pbmRleCwgaXRlbSkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9KVxuICAgIC50d2VlbihcImludGVycG9sYXRlLWNvbG9yXCIsIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICBpZiAoaXRlbS5jb2xvci5pbnRlcnBvbGF0ZSAmJiBpdGVtLmNvbG9yLmludGVycG9sYXRlLmxlbmd0aCA9PSAyKSB7XG4gICAgICAgIHZhciBjb2xvckludGVycG9sYXRvciA9IGQzLmludGVycG9sYXRlSHNsKGl0ZW0uY29sb3IuaW50ZXJwb2xhdGVbMF0sIGl0ZW0uY29sb3IuaW50ZXJwb2xhdGVbMV0pO1xuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAodCkge1xuICAgICAgICAgIHZhciBjb2xvciA9IGNvbG9ySW50ZXJwb2xhdG9yKGl0ZW0ucGVyY2VudGFnZSAvIDEwMCk7XG4gICAgICAgICAgZDMuc2VsZWN0KHRoaXMpLnN0eWxlKCdmaWxsJywgY29sb3IpO1xuICAgICAgICAgIGQzLnNlbGVjdCh0aGlzLnBhcmVudE5vZGUpLnNlbGVjdCgncGF0aC5iZycpLnN0eWxlKCdmaWxsJywgY29sb3IpO1xuICAgICAgICB9O1xuICAgICAgfVxuICAgIH0pXG4gICAgLnN0eWxlKFwiZmlsbFwiLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgaWYgKGl0ZW0uY29sb3Iuc29saWQpIHtcbiAgICAgICAgcmV0dXJuIGl0ZW0uY29sb3Iuc29saWQ7XG4gICAgICB9XG5cbiAgICAgIGlmIChpdGVtLmNvbG9yLmxpbmVhckdyYWRpZW50IHx8IGl0ZW0uY29sb3IucmFkaWFsR3JhZGllbnQpIHtcbiAgICAgICAgcmV0dXJuIFwidXJsKCNncmFkaWVudFwiICsgaXRlbS5pbmRleCArICcpJztcbiAgICAgIH1cbiAgICB9KTtcbn07XG5cbi8qKlxuICogUmVtb3ZlIHN2ZyBhbmQgY2xlYW4gc29tZSByZWZlcmVuY2VzXG4gKi9cblJhZGlhbFByb2dyZXNzQ2hhcnQucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuc3ZnLnJlbW92ZSgpO1xuICBkZWxldGUgdGhpcy5zdmc7XG59O1xuXG4vKipcbiAqIERldGFjaCBhbmQgbm9ybWFsaXplIHVzZXIncyBvcHRpb25zIGlucHV0LlxuICovXG5SYWRpYWxQcm9ncmVzc0NoYXJ0Lm5vcm1hbGl6ZU9wdGlvbnMgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICBpZiAoIW9wdGlvbnMgfHwgdHlwZW9mIG9wdGlvbnMgIT09ICdvYmplY3QnKSB7XG4gICAgb3B0aW9ucyA9IHt9O1xuICB9XG5cbiAgdmFyIF9vcHRpb25zID0ge1xuICAgIGRpYW1ldGVyOiBvcHRpb25zLmRpYW1ldGVyIHx8IDEwMCxcbiAgICBzdHJva2U6IHtcbiAgICAgIHdpZHRoOiBvcHRpb25zLnN0cm9rZSAmJiBvcHRpb25zLnN0cm9rZS53aWR0aCB8fCA0MCxcbiAgICAgIGdhcDogb3B0aW9ucy5zdHJva2UgJiYgb3B0aW9ucy5zdHJva2UuZ2FwIHx8IDJcbiAgICB9LFxuICAgIGFuaW1hdGlvbjoge1xuICAgICAgZHVyYXRpb246IG9wdGlvbnMuYW5pbWF0aW9uICYmIG9wdGlvbnMuYW5pbWF0aW9uLmR1cmF0aW9uIHx8IDE3NTAsXG4gICAgICBkZWxheTogb3B0aW9ucy5hbmltYXRpb24gJiYgb3B0aW9ucy5hbmltYXRpb24uZGVsYXkgfHwgMjAwXG4gICAgfSxcbiAgICBtaW46IG9wdGlvbnMubWluIHx8IDAsXG4gICAgbWF4OiBvcHRpb25zLm1heCB8fCAxMDAsXG4gICAgcm91bmQ6IG9wdGlvbnMucm91bmQgIT09IHVuZGVmaW5lZCA/ICEhb3B0aW9ucy5yb3VuZCA6IHRydWUsXG4gICAgc2VyaWVzOiBvcHRpb25zLnNlcmllcyB8fCBbXSxcbiAgICBjZW50ZXI6IFJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplQ2VudGVyKG9wdGlvbnMuY2VudGVyKVxuICB9O1xuXG4gIHZhciBkZWZhdWx0Q29sb3JzSXRlcmF0b3IgPSBuZXcgUmFkaWFsUHJvZ3Jlc3NDaGFydC5Db2xvcnNJdGVyYXRvcigpO1xuICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gX29wdGlvbnMuc2VyaWVzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGl0ZW0gPSBvcHRpb25zLnNlcmllc1tpXTtcblxuICAgIC8vIGNvbnZlcnQgbnVtYmVyIHRvIG9iamVjdFxuICAgIGlmICh0eXBlb2YgaXRlbSA9PT0gJ251bWJlcicpIHtcbiAgICAgIGl0ZW0gPSB7dmFsdWU6IGl0ZW19O1xuICAgIH1cblxuICAgIF9vcHRpb25zLnNlcmllc1tpXSA9IHtcbiAgICAgIGluZGV4OiBpLFxuICAgICAgdmFsdWU6IGl0ZW0udmFsdWUsXG4gICAgICBsYWJlbFN0YXJ0OiBpdGVtLmxhYmVsU3RhcnQsXG4gICAgICBjb2xvcjogUmFkaWFsUHJvZ3Jlc3NDaGFydC5ub3JtYWxpemVDb2xvcihpdGVtLmNvbG9yLCBkZWZhdWx0Q29sb3JzSXRlcmF0b3IpXG4gICAgfTtcbiAgfVxuXG4gIHJldHVybiBfb3B0aW9ucztcbn07XG5cbi8qKlxuICogTm9ybWFsaXplIGRpZmZlcmVudCBub3RhdGlvbnMgb2YgY29sb3IgcHJvcGVydHlcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xBcnJheXxPYmplY3R9IGNvbG9yXG4gKiBAZXhhbXBsZSAnI2ZlMDhiNSdcbiAqIEBleGFtcGxlIHsgc29saWQ6ICcjZmUwOGI1JywgYmFja2dyb3VuZDogJyMwMDAwMDAnIH1cbiAqIEBleGFtcGxlIFsnIzAwMDAwMCcsICcjZmYwMDAwJ11cbiAqIEBleGFtcGxlIHtcbiAgICAgICAgICAgICAgICBsaW5lYXJHcmFkaWVudDogeyB4MTogJzAlJywgeTE6ICcxMDAlJywgeDI6ICc1MCUnLCB5MjogJzAlJ30sXG4gICAgICAgICAgICAgICAgc3RvcHM6IFtcbiAgICAgICAgICAgICAgICAgIHtvZmZzZXQ6ICcwJScsICdzdG9wLWNvbG9yJzogJyNmZTA4YjUnLCAnc3RvcC1vcGFjaXR5JzogMX0sXG4gICAgICAgICAgICAgICAgICB7b2Zmc2V0OiAnMTAwJScsICdzdG9wLWNvbG9yJzogJyNmZjE0MTAnLCAnc3RvcC1vcGFjaXR5JzogMX1cbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgIH1cbiAqIEBleGFtcGxlIHtcbiAgICAgICAgICAgICAgICByYWRpYWxHcmFkaWVudDoge2N4OiAnNjAnLCBjeTogJzYwJywgcjogJzUwJ30sXG4gICAgICAgICAgICAgICAgc3RvcHM6IFtcbiAgICAgICAgICAgICAgICAgIHtvZmZzZXQ6ICcwJScsICdzdG9wLWNvbG9yJzogJyNmZTA4YjUnLCAnc3RvcC1vcGFjaXR5JzogMX0sXG4gICAgICAgICAgICAgICAgICB7b2Zmc2V0OiAnMTAwJScsICdzdG9wLWNvbG9yJzogJyNmZjE0MTAnLCAnc3RvcC1vcGFjaXR5JzogMX1cbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgIH1cbiAqXG4gKi9cblJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplQ29sb3IgPSBmdW5jdGlvbiAoY29sb3IsIGRlZmF1bHRDb2xvcnNJdGVyYXRvcikge1xuXG4gIGlmICghY29sb3IpIHtcbiAgICBjb2xvciA9IHtzb2xpZDogZGVmYXVsdENvbG9yc0l0ZXJhdG9yLm5leHQoKX07XG4gIH0gZWxzZSBpZiAodHlwZW9mIGNvbG9yID09PSAnc3RyaW5nJykge1xuICAgIGNvbG9yID0ge3NvbGlkOiBjb2xvcn07XG4gIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShjb2xvcikpIHtcbiAgICBjb2xvciA9IHtpbnRlcnBvbGF0ZTogY29sb3J9O1xuICB9IGVsc2UgaWYgKHR5cGVvZiBjb2xvciA9PT0gJ29iamVjdCcpIHtcbiAgICBpZiAoIWNvbG9yLnNvbGlkICYmICFjb2xvci5pbnRlcnBvbGF0ZSAmJiAhY29sb3IubGluZWFyR3JhZGllbnQgJiYgIWNvbG9yLnJhZGlhbEdyYWRpZW50KSB7XG4gICAgICBjb2xvci5zb2xpZCA9IGRlZmF1bHRDb2xvcnNJdGVyYXRvci5uZXh0KCk7XG4gICAgfVxuICB9XG5cbiAgLy8gVmFsaWRhdGUgaW50ZXJwb2xhdGUgc3ludGF4XG4gIGlmIChjb2xvci5pbnRlcnBvbGF0ZSkge1xuICAgIGlmIChjb2xvci5pbnRlcnBvbGF0ZS5sZW5ndGggIT09IDIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignaW50ZXJwb2xhdGUgYXJyYXkgc2hvdWxkIGNvbnRhaW4gdHdvIGNvbG9ycycpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFZhbGlkYXRlIGdyYWRpZW50IHN5bnRheFxuICBpZiAoY29sb3IubGluZWFyR3JhZGllbnQgfHwgY29sb3IucmFkaWFsR3JhZGllbnQpIHtcbiAgICBpZiAoIWNvbG9yLnN0b3BzIHx8ICFBcnJheS5pc0FycmF5KGNvbG9yLnN0b3BzKSB8fCBjb2xvci5zdG9wcy5sZW5ndGggIT09IDIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignZ3JhZGllbnQgc3ludGF4IGlzIG1hbGZvcm1lZCcpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFNldCBiYWNrZ3JvdW5kIHdoZW4gaXMgbm90IHByb3ZpZGVkXG4gIGlmICghY29sb3IuYmFja2dyb3VuZCkge1xuICAgIGlmIChjb2xvci5zb2xpZCkge1xuICAgICAgY29sb3IuYmFja2dyb3VuZCA9IGNvbG9yLnNvbGlkO1xuICAgIH0gZWxzZSBpZiAoY29sb3IuaW50ZXJwb2xhdGUpIHtcbiAgICAgIGNvbG9yLmJhY2tncm91bmQgPSBjb2xvci5pbnRlcnBvbGF0ZVswXTtcbiAgICB9IGVsc2UgaWYgKGNvbG9yLmxpbmVhckdyYWRpZW50IHx8IGNvbG9yLnJhZGlhbEdyYWRpZW50KSB7XG4gICAgICBjb2xvci5iYWNrZ3JvdW5kID0gY29sb3Iuc3RvcHNbMF1bJ3N0b3AtY29sb3InXTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gY29sb3I7XG5cbn07XG5cblxuLyoqXG4gKiBOb3JtYWxpemUgZGlmZmVyZW50IG5vdGF0aW9ucyBvZiBjZW50ZXIgcHJvcGVydHlcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xBcnJheXxGdW5jdGlvbnxPYmplY3R9IGNlbnRlclxuICogQGV4YW1wbGUgJ2ZvbyBiYXInXG4gKiBAZXhhbXBsZSB7IGNvbnRlbnQ6ICdmb28gYmFyJywgeDogMTAsIHk6IDQgfVxuICogQGV4YW1wbGUgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBpdGVtKSB7fVxuICogQGV4YW1wbGUgWydmb28gYmFyJywgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBpdGVtKSB7fV1cbiAqL1xuUmFkaWFsUHJvZ3Jlc3NDaGFydC5ub3JtYWxpemVDZW50ZXIgPSBmdW5jdGlvbiAoY2VudGVyKSB7XG4gIGlmICghY2VudGVyKSByZXR1cm4gbnVsbDtcblxuICAvLyBDb252ZXJ0IHRvIG9iamVjdCBub3RhdGlvblxuICBpZiAoY2VudGVyLmNvbnN0cnVjdG9yICE9PSBPYmplY3QpIHtcbiAgICBjZW50ZXIgPSB7Y29udGVudDogY2VudGVyfTtcbiAgfVxuXG4gIC8vIERlZmF1bHRzXG4gIGNlbnRlci5jb250ZW50ID0gY2VudGVyLmNvbnRlbnQgfHwgW107XG4gIGNlbnRlci54ID0gY2VudGVyLnggfHwgMDtcbiAgY2VudGVyLnkgPSBjZW50ZXIueSB8fCAwO1xuXG4gIC8vIENvbnZlcnQgY29udGVudCB0byBhcnJheSBub3RhdGlvblxuICBpZiAoIUFycmF5LmlzQXJyYXkoY2VudGVyLmNvbnRlbnQpKSB7XG4gICAgY2VudGVyLmNvbnRlbnQgPSBbY2VudGVyLmNvbnRlbnRdO1xuICB9XG5cbiAgcmV0dXJuIGNlbnRlcjtcbn07XG5cbi8vIExpbmVhciBvciBSYWRpYWwgR3JhZGllbnQgaW50ZXJuYWwgb2JqZWN0XG5SYWRpYWxQcm9ncmVzc0NoYXJ0LkdyYWRpZW50ID0gKGZ1bmN0aW9uICgpIHtcbiAgZnVuY3Rpb24gR3JhZGllbnQoKSB7XG4gIH1cblxuICBHcmFkaWVudC50b1NWR0VsZW1lbnQgPSBmdW5jdGlvbiAoaWQsIG9wdGlvbnMpIHtcbiAgICB2YXIgZ3JhZGllbnRUeXBlID0gb3B0aW9ucy5saW5lYXJHcmFkaWVudCA/ICdsaW5lYXJHcmFkaWVudCcgOiAncmFkaWFsR3JhZGllbnQnO1xuICAgIHZhciBncmFkaWVudCA9IGQzLnNlbGVjdChkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoZDMubnMucHJlZml4LnN2ZywgZ3JhZGllbnRUeXBlKSlcbiAgICAgIC5hdHRyKG9wdGlvbnNbZ3JhZGllbnRUeXBlXSlcbiAgICAgIC5hdHRyKCdpZCcsIGlkKTtcblxuICAgIG9wdGlvbnMuc3RvcHMuZm9yRWFjaChmdW5jdGlvbiAoc3RvcEF0dHJzKSB7XG4gICAgICBncmFkaWVudC5hcHBlbmQoXCJzdmc6c3RvcFwiKS5hdHRyKHN0b3BBdHRycyk7XG4gICAgfSk7XG5cbiAgICB0aGlzLmJhY2tncm91bmQgPSBvcHRpb25zLnN0b3BzWzBdWydzdG9wLWNvbG9yJ107XG5cbiAgICByZXR1cm4gZ3JhZGllbnQubm9kZSgpO1xuICB9O1xuXG4gIHJldHVybiBHcmFkaWVudDtcbn0pKCk7XG5cbi8vIERlZmF1bHQgY29sb3JzIGl0ZXJhdG9yXG5SYWRpYWxQcm9ncmVzc0NoYXJ0LkNvbG9yc0l0ZXJhdG9yID0gKGZ1bmN0aW9uICgpIHtcblxuICBDb2xvcnNJdGVyYXRvci5ERUZBVUxUX0NPTE9SUyA9IFtcIiMxYWQ1ZGVcIiwgXCIjYTBmZjAzXCIsIFwiI2U5MGIzYVwiLCAnI2ZmOTUwMCcsICcjMDA3YWZmJywgJyNmZmNjMDAnLCAnIzU4NTZkNicsICcjOGU4ZTkzJ107XG5cbiAgZnVuY3Rpb24gQ29sb3JzSXRlcmF0b3IoKSB7XG4gICAgdGhpcy5pbmRleCA9IDA7XG4gIH1cblxuICBDb2xvcnNJdGVyYXRvci5wcm90b3R5cGUubmV4dCA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5pbmRleCA9PT0gQ29sb3JzSXRlcmF0b3IuREVGQVVMVF9DT0xPUlMubGVuZ3RoKSB7XG4gICAgICB0aGlzLmluZGV4ID0gMDtcbiAgICB9XG5cbiAgICByZXR1cm4gQ29sb3JzSXRlcmF0b3IuREVGQVVMVF9DT0xPUlNbdGhpcy5pbmRleCsrXTtcbiAgfTtcblxuICByZXR1cm4gQ29sb3JzSXRlcmF0b3I7XG59KSgpO1xuXG5cbi8vIEV4cG9ydCBSYWRpYWxQcm9ncmVzc0NoYXJ0IG9iamVjdFxuaWYgKHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIpbW9kdWxlLmV4cG9ydHMgPSBSYWRpYWxQcm9ncmVzc0NoYXJ0OyJdfQ==
