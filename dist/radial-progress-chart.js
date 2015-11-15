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
      gap: options.stroke && options.stroke.gap || 2
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbnZhciBkMztcblxuLy8gUmFkaWFsUHJvZ3Jlc3NDaGFydCBvYmplY3RcbmZ1bmN0aW9uIFJhZGlhbFByb2dyZXNzQ2hhcnQocXVlcnksIG9wdGlvbnMpIHtcblxuICAvLyB2ZXJpZnkgZDMgaXMgbG9hZGVkXG4gIGQzID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5kMykgPyB3aW5kb3cuZDMgOiB0eXBlb2YgcmVxdWlyZSAhPT0gJ3VuZGVmaW5lZCcgPyByZXF1aXJlKFwiZDNcIikgOiB1bmRlZmluZWQ7XG4gIGlmKCFkMykgdGhyb3cgbmV3IEVycm9yKCdkMyBvYmplY3QgaXMgbWlzc2luZy4gRDMuanMgbGlicmFyeSBoYXMgdG8gYmUgbG9hZGVkIGJlZm9yZS4nKTtcblxuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYub3B0aW9ucyA9IFJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplT3B0aW9ucyhvcHRpb25zKTtcblxuICAvLyBpbnRlcm5hbCAgdmFyaWFibGVzXG4gIHZhciBzZXJpZXMgPSBzZWxmLm9wdGlvbnMuc2VyaWVzXG4gICAgLCB3aWR0aCA9IDE1ICsgKChzZWxmLm9wdGlvbnMuZGlhbWV0ZXIgLyAyKSArIChzZWxmLm9wdGlvbnMuc3Ryb2tlLndpZHRoICogc2VsZi5vcHRpb25zLnNlcmllcy5sZW5ndGgpICsgKHNlbGYub3B0aW9ucy5zdHJva2UuZ2FwICogc2VsZi5vcHRpb25zLnNlcmllcy5sZW5ndGggLSAxKSkgKiAyXG4gICAgLCBoZWlnaHQgPSB3aWR0aFxuICAgICwgz4QgPSAyICogTWF0aC5QSVxuICAgICwgaW5uZXIgPSBbXVxuICAgICwgb3V0ZXIgPSBbXTtcblxuICBmdW5jdGlvbiBpbm5lclJhZGl1cyhpdGVtKSB7XG4gICAgdmFyIHJhZGl1cyA9IGlubmVyW2l0ZW0uaW5kZXhdO1xuICAgIGlmIChyYWRpdXMpIHJldHVybiByYWRpdXM7XG5cbiAgICAvLyBmaXJzdCByaW5nIGJhc2VkIG9uIGRpYW1ldGVyIGFuZCB0aGUgcmVzdCBiYXNlZCBvbiB0aGUgcHJldmlvdXMgb3V0ZXIgcmFkaXVzIHBsdXMgZ2FwXG4gICAgcmFkaXVzID0gaXRlbS5pbmRleCA9PT0gMCA/IHNlbGYub3B0aW9ucy5kaWFtZXRlciAvIDIgOiBvdXRlcltpdGVtLmluZGV4IC0gMV0gKyBzZWxmLm9wdGlvbnMuc3Ryb2tlLmdhcDtcbiAgICBpbm5lcltpdGVtLmluZGV4XSA9IHJhZGl1cztcbiAgICByZXR1cm4gcmFkaXVzO1xuICB9XG5cbiAgZnVuY3Rpb24gb3V0ZXJSYWRpdXMoaXRlbSkge1xuICAgIHZhciByYWRpdXMgPSBvdXRlcltpdGVtLmluZGV4XTtcbiAgICBpZiAocmFkaXVzKSByZXR1cm4gcmFkaXVzO1xuXG4gICAgLy8gYmFzZWQgb24gdGhlIHByZXZpb3VzIGlubmVyIHJhZGl1cyArIHN0cm9rZSB3aWR0aFxuICAgIHJhZGl1cyA9IGlubmVyW2l0ZW0uaW5kZXhdICsgc2VsZi5vcHRpb25zLnN0cm9rZS53aWR0aDtcbiAgICBvdXRlcltpdGVtLmluZGV4XSA9IHJhZGl1cztcbiAgICByZXR1cm4gcmFkaXVzO1xuICB9XG5cbiAgc2VsZi5wcm9ncmVzcyA9IGQzLnN2Zy5hcmMoKVxuICAgIC5zdGFydEFuZ2xlKDApXG4gICAgLmVuZEFuZ2xlKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICByZXR1cm4gaXRlbS5wZXJjZW50YWdlIC8gMTAwICogz4Q7XG4gICAgfSlcbiAgICAuaW5uZXJSYWRpdXMoaW5uZXJSYWRpdXMpXG4gICAgLm91dGVyUmFkaXVzKG91dGVyUmFkaXVzKVxuICAgIC5jb3JuZXJSYWRpdXMoZnVuY3Rpb24gKGQpIHtcbiAgICAgIC8vIFdvcmthcm91bmQgZm9yIGQzIGJ1ZyBodHRwczovL2dpdGh1Yi5jb20vbWJvc3RvY2svZDMvaXNzdWVzLzIyNDlcbiAgICAgIC8vIFJlZHVjZSBjb3JuZXIgcmFkaXVzIHdoZW4gY29ybmVycyBhcmUgY2xvc2UgZWFjaCBvdGhlclxuICAgICAgdmFyIG0gPSBkLnBlcmNlbnRhZ2UgPj0gOTAgPyAoMTAwIC0gZC5wZXJjZW50YWdlKSAqIDAuMSA6IDE7XG4gICAgICByZXR1cm4gKHNlbGYub3B0aW9ucy5zdHJva2Uud2lkdGggLyAyKSAqIG07XG4gICAgfSk7XG5cbiAgdmFyIGJhY2tncm91bmQgPSBkMy5zdmcuYXJjKClcbiAgICAuc3RhcnRBbmdsZSgwKVxuICAgIC5lbmRBbmdsZSjPhClcbiAgICAuaW5uZXJSYWRpdXMoaW5uZXJSYWRpdXMpXG4gICAgLm91dGVyUmFkaXVzKG91dGVyUmFkaXVzKTtcblxuICAvLyBjcmVhdGUgc3ZnXG4gIHNlbGYuc3ZnID0gZDMuc2VsZWN0KHF1ZXJ5KS5hcHBlbmQoXCJzdmdcIilcbiAgICAuYXR0cihcIndpZHRoXCIsIHdpZHRoKVxuICAgIC5hdHRyKFwiaGVpZ2h0XCIsIGhlaWdodClcbiAgICAuYXBwZW5kKFwiZ1wiKVxuICAgIC5hdHRyKFwidHJhbnNmb3JtXCIsIFwidHJhbnNsYXRlKFwiICsgd2lkdGggLyAyICsgXCIsXCIgKyBoZWlnaHQgLyAyICsgXCIpXCIpO1xuXG4gIC8vIGFkZCBncmFkaWVudHMgZGVmc1xuICB2YXIgZGVmcyA9IHNlbGYuc3ZnLmFwcGVuZChcInN2ZzpkZWZzXCIpO1xuICBzZXJpZXMuZm9yRWFjaChmdW5jdGlvbiAoaXRlbSkge1xuICAgIGlmIChpdGVtLmNvbG9yLmxpbmVhckdyYWRpZW50IHx8IGl0ZW0uY29sb3IucmFkaWFsR3JhZGllbnQpIHtcbiAgICAgIHZhciBncmFkaWVudCA9IFJhZGlhbFByb2dyZXNzQ2hhcnQuR3JhZGllbnQudG9TVkdFbGVtZW50KCdncmFkaWVudCcgKyBpdGVtLmluZGV4LCBpdGVtLmNvbG9yKTtcbiAgICAgIGRlZnMubm9kZSgpLmFwcGVuZENoaWxkKGdyYWRpZW50KTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIGFkZCBzaGFkb3dzIGRlZnNcbiAgZGVmcyA9IHNlbGYuc3ZnLmFwcGVuZChcInN2ZzpkZWZzXCIpO1xuICB2YXIgZHJvcHNoYWRvd0lkID0gXCJkcm9wc2hhZG93LVwiICsgTWF0aC5yYW5kb20oKTtcbiAgdmFyIGZpbHRlciA9IGRlZnMuYXBwZW5kKFwiZmlsdGVyXCIpLmF0dHIoXCJpZFwiLCBkcm9wc2hhZG93SWQpO1xuICBpZihzZWxmLm9wdGlvbnMuc2hhZG93LndpZHRoID4gMCkge1xuICAgIFxuICAgIGZpbHRlci5hcHBlbmQoXCJmZUdhdXNzaWFuQmx1clwiKVxuICAgICAgLmF0dHIoXCJpblwiLCBcIlNvdXJjZUFscGhhXCIpXG4gICAgICAuYXR0cihcInN0ZERldmlhdGlvblwiLCBzZWxmLm9wdGlvbnMuc2hhZG93LndpZHRoKVxuICAgICAgLmF0dHIoXCJyZXN1bHRcIiwgXCJibHVyXCIpO1xuXG4gICAgZmlsdGVyLmFwcGVuZChcImZlT2Zmc2V0XCIpXG4gICAgICAuYXR0cihcImluXCIsIFwiYmx1clwiKVxuICAgICAgLmF0dHIoXCJkeFwiLCAxKVxuICAgICAgLmF0dHIoXCJkeVwiLCAxKVxuICAgICAgLmF0dHIoXCJyZXN1bHRcIiwgXCJvZmZzZXRCbHVyXCIpO1xuICB9XG5cbiAgdmFyIGZlTWVyZ2UgPSBmaWx0ZXIuYXBwZW5kKFwiZmVNZXJnZVwiKTtcbiAgZmVNZXJnZS5hcHBlbmQoXCJmZU1lcmdlTm9kZVwiKS5hdHRyKFwiaW5cIiwgXCJvZmZzZXRCbHVyXCIpO1xuICBmZU1lcmdlLmFwcGVuZChcImZlTWVyZ2VOb2RlXCIpLmF0dHIoXCJpblwiLCBcIlNvdXJjZUdyYXBoaWNcIik7XG5cbiAgLy8gYWRkIGlubmVyIHRleHRcbiAgaWYgKHNlbGYub3B0aW9ucy5jZW50ZXIpIHtcbiAgICBzZWxmLnN2Zy5hcHBlbmQoXCJ0ZXh0XCIpXG4gICAgICAuYXR0cignY2xhc3MnLCAncmJjLWNlbnRlci10ZXh0JylcbiAgICAgIC5hdHRyKFwidGV4dC1hbmNob3JcIiwgXCJtaWRkbGVcIilcbiAgICAgIC5hdHRyKCd4Jywgc2VsZi5vcHRpb25zLmNlbnRlci54ICsgJ3B4JylcbiAgICAgIC5hdHRyKCd5Jywgc2VsZi5vcHRpb25zLmNlbnRlci55ICsgJ3B4JylcbiAgICAgIC5zZWxlY3RBbGwoJ3RzcGFuJylcbiAgICAgIC5kYXRhKHNlbGYub3B0aW9ucy5jZW50ZXIuY29udGVudCkuZW50ZXIoKVxuICAgICAgLmFwcGVuZCgndHNwYW4nKVxuICAgICAgLmF0dHIoXCJkb21pbmFudC1iYXNlbGluZVwiLCBmdW5jdGlvbiAoKSB7XG5cbiAgICAgICAgLy8gU2luZ2xlIGxpbmVzIGNhbiBlYXNpbHkgY2VudGVyZWQgaW4gdGhlIG1pZGRsZSB1c2luZyBkb21pbmFudC1iYXNlbGluZSwgbXVsdGlsaW5lIG5lZWQgdG8gdXNlIHlcbiAgICAgICAgaWYgKHNlbGYub3B0aW9ucy5jZW50ZXIuY29udGVudC5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICByZXR1cm4gJ2NlbnRyYWwnO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLmF0dHIoJ2NsYXNzJywgZnVuY3Rpb24gKGQsIGkpIHtcbiAgICAgICAgcmV0dXJuICdyYmMtY2VudGVyLXRleHQtbGluZScgKyBpO1xuICAgICAgfSlcbiAgICAgIC5hdHRyKCd4JywgMClcbiAgICAgIC5hdHRyKCdkeScsIGZ1bmN0aW9uIChkLCBpKSB7XG4gICAgICAgIGlmIChpID4gMCkge1xuICAgICAgICAgIHJldHVybiAnMS4xZW0nO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLmVhY2goZnVuY3Rpb24gKGQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBkID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgdGhpcy5jYWxsYmFjayA9IGQ7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAudGV4dChmdW5jdGlvbiAoZCkge1xuICAgICAgICBpZiAodHlwZW9mIGQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgcmV0dXJuIGQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gJyc7XG4gICAgICB9KTtcbiAgfVxuXG4gIC8vIGFkZCByaW5nIHN0cnVjdHVyZVxuICBzZWxmLmZpZWxkID0gc2VsZi5zdmcuc2VsZWN0QWxsKFwiZ1wiKVxuICAgIC5kYXRhKHNlcmllcylcbiAgICAuZW50ZXIoKS5hcHBlbmQoXCJnXCIpO1xuXG4gIHNlbGYuZmllbGQuYXBwZW5kKFwicGF0aFwiKS5hdHRyKFwiY2xhc3NcIiwgXCJwcm9ncmVzc1wiKS5hdHRyKFwiZmlsdGVyXCIsIFwidXJsKCNcIiArIGRyb3BzaGFkb3dJZCArXCIpXCIpO1xuXG4gIHNlbGYuZmllbGQuYXBwZW5kKFwicGF0aFwiKS5hdHRyKFwiY2xhc3NcIiwgXCJiZ1wiKVxuICAgIC5zdHlsZShcImZpbGxcIiwgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgIHJldHVybiBpdGVtLmNvbG9yLmJhY2tncm91bmQ7XG4gICAgfSlcbiAgICAuc3R5bGUoXCJvcGFjaXR5XCIsIDAuMilcbiAgICAuYXR0cihcImRcIiwgYmFja2dyb3VuZCk7XG5cbiAgc2VsZi5maWVsZC5hcHBlbmQoXCJ0ZXh0XCIpXG4gICAgLmNsYXNzZWQoJ3JiYy1sYWJlbCByYmMtbGFiZWwtc3RhcnQnLCB0cnVlKVxuICAgIC5hdHRyKFwiZG9taW5hbnQtYmFzZWxpbmVcIiwgXCJjZW50cmFsXCIpXG4gICAgLmF0dHIoXCJ4XCIsIFwiMTBcIilcbiAgICAuYXR0cihcInlcIiwgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgIHJldHVybiAtKFxuICAgICAgICBzZWxmLm9wdGlvbnMuZGlhbWV0ZXIgLyAyICtcbiAgICAgICAgaXRlbS5pbmRleCAqIChzZWxmLm9wdGlvbnMuc3Ryb2tlLmdhcCArIHNlbGYub3B0aW9ucy5zdHJva2Uud2lkdGgpICtcbiAgICAgICAgc2VsZi5vcHRpb25zLnN0cm9rZS53aWR0aCAvIDJcbiAgICAgICAgKTtcbiAgICB9KVxuICAgIC50ZXh0KGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICByZXR1cm4gaXRlbS5sYWJlbFN0YXJ0O1xuICAgIH0pO1xuXG4gIHNlbGYudXBkYXRlKCk7XG59XG5cbi8qKlxuICogVXBkYXRlIGRhdGEgdG8gYmUgdmlzdWFsaXplZCBpbiB0aGUgY2hhcnQuXG4gKlxuICogQHBhcmFtIHtPYmplY3R8QXJyYXl9IGRhdGEgT3B0aW9uYWwgZGF0YSB5b3UnZCBsaWtlIHRvIHNldCBmb3IgdGhlIGNoYXJ0IGJlZm9yZSBpdCB3aWxsIHVwZGF0ZS4gSWYgbm90IHNwZWNpZmllZCB0aGUgdXBkYXRlIG1ldGhvZCB3aWxsIHVzZSB0aGUgZGF0YSB0aGF0IGlzIGFscmVhZHkgY29uZmlndXJlZCB3aXRoIHRoZSBjaGFydC5cbiAqIEBleGFtcGxlIHVwZGF0ZShbNzAsIDEwLCA0NV0pXG4gKiBAZXhhbXBsZSB1cGRhdGUoe3NlcmllczogW3t2YWx1ZTogNzB9LCAxMCwgNDVdfSlcbiAqXG4gKi9cblJhZGlhbFByb2dyZXNzQ2hhcnQucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uIChkYXRhKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICAvLyBwYXJzZSBuZXcgZGF0YVxuICBpZiAoZGF0YSkge1xuICAgIGlmICh0eXBlb2YgZGF0YSA9PT0gJ251bWJlcicpIHtcbiAgICAgIGRhdGEgPSBbZGF0YV07XG4gICAgfVxuXG4gICAgdmFyIHNlcmllcztcblxuICAgIGlmIChBcnJheS5pc0FycmF5KGRhdGEpKSB7XG4gICAgICBzZXJpZXMgPSBkYXRhO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGRhdGEgPT09ICdvYmplY3QnKSB7XG4gICAgICBzZXJpZXMgPSBkYXRhLnNlcmllcyB8fCBbXTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNlcmllcy5sZW5ndGg7IGkrKykge1xuICAgICAgdGhpcy5vcHRpb25zLnNlcmllc1tpXS5wcmV2aW91c1ZhbHVlID0gdGhpcy5vcHRpb25zLnNlcmllc1tpXS52YWx1ZTtcblxuICAgICAgdmFyIGl0ZW0gPSBzZXJpZXNbaV07XG4gICAgICBpZiAodHlwZW9mIGl0ZW0gPT09ICdudW1iZXInKSB7XG4gICAgICAgIHRoaXMub3B0aW9ucy5zZXJpZXNbaV0udmFsdWUgPSBpdGVtO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgdGhpcy5vcHRpb25zLnNlcmllc1tpXS52YWx1ZSA9IGl0ZW0udmFsdWU7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gY2FsY3VsYXRlIGZyb20gcGVyY2VudGFnZSBhbmQgbmV3IHBlcmNlbnRhZ2UgZm9yIHRoZSBwcm9ncmVzcyBhbmltYXRpb25cbiAgc2VsZi5vcHRpb25zLnNlcmllcy5mb3JFYWNoKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgaXRlbS5mcm9tUGVyY2VudGFnZSA9IGl0ZW0ucGVyY2VudGFnZSA/IGl0ZW0ucGVyY2VudGFnZSA6IDU7XG4gICAgaXRlbS5wZXJjZW50YWdlID0gKGl0ZW0udmFsdWUgLSBzZWxmLm9wdGlvbnMubWluKSAqIDEwMCAvIChzZWxmLm9wdGlvbnMubWF4IC0gc2VsZi5vcHRpb25zLm1pbik7XG4gIH0pO1xuXG4gIHZhciBjZW50ZXIgPSBzZWxmLnN2Zy5zZWxlY3QoXCJ0ZXh0LnJiYy1jZW50ZXItdGV4dFwiKTtcblxuICAvLyBwcm9ncmVzc1xuICBzZWxmLmZpZWxkLnNlbGVjdChcInBhdGgucHJvZ3Jlc3NcIilcbiAgICAuaW50ZXJydXB0KClcbiAgICAudHJhbnNpdGlvbigpXG4gICAgLmR1cmF0aW9uKHNlbGYub3B0aW9ucy5hbmltYXRpb24uZHVyYXRpb24pXG4gICAgLmRlbGF5KGZ1bmN0aW9uIChkLCBpKSB7XG4gICAgICAvLyBkZWxheSBiZXR3ZWVuIGVhY2ggaXRlbVxuICAgICAgcmV0dXJuIGkgKiBzZWxmLm9wdGlvbnMuYW5pbWF0aW9uLmRlbGF5O1xuICAgIH0pXG4gICAgLmVhc2UoXCJlbGFzdGljXCIpXG4gICAgLmF0dHJUd2VlbihcImRcIiwgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgIHZhciBpbnRlcnBvbGF0b3IgPSBkMy5pbnRlcnBvbGF0ZU51bWJlcihpdGVtLmZyb21QZXJjZW50YWdlLCBpdGVtLnBlcmNlbnRhZ2UpO1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uICh0KSB7XG4gICAgICAgIGl0ZW0ucGVyY2VudGFnZSA9IGludGVycG9sYXRvcih0KTtcbiAgICAgICAgcmV0dXJuIHNlbGYucHJvZ3Jlc3MoaXRlbSk7XG4gICAgICB9O1xuICAgIH0pXG4gICAgLnR3ZWVuKFwiY2VudGVyXCIsIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAvLyBFeGVjdXRlIGNhbGxiYWNrcyBvbiBlYWNoIGxpbmVcbiAgICAgIGlmIChzZWxmLm9wdGlvbnMuY2VudGVyKSB7XG4gICAgICAgIHZhciBpbnRlcnBvbGF0ZSA9IHNlbGYub3B0aW9ucy5yb3VuZCA/IGQzLmludGVycG9sYXRlUm91bmQgOiBkMy5pbnRlcnBvbGF0ZU51bWJlcjtcbiAgICAgICAgdmFyIGludGVycG9sYXRvciA9IGludGVycG9sYXRlKGl0ZW0ucHJldmlvdXNWYWx1ZSB8fCAwLCBpdGVtLnZhbHVlKTtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICh0KSB7XG4gICAgICAgICAgY2VudGVyXG4gICAgICAgICAgICAuc2VsZWN0QWxsKCd0c3BhbicpXG4gICAgICAgICAgICAuZWFjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgIGlmICh0aGlzLmNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgZDMuc2VsZWN0KHRoaXMpLnRleHQodGhpcy5jYWxsYmFjayhpbnRlcnBvbGF0b3IodCksIGl0ZW0uaW5kZXgsIGl0ZW0pKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfSlcbiAgICAudHdlZW4oXCJpbnRlcnBvbGF0ZS1jb2xvclwiLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgaWYgKGl0ZW0uY29sb3IuaW50ZXJwb2xhdGUgJiYgaXRlbS5jb2xvci5pbnRlcnBvbGF0ZS5sZW5ndGggPT0gMikge1xuICAgICAgICB2YXIgY29sb3JJbnRlcnBvbGF0b3IgPSBkMy5pbnRlcnBvbGF0ZUhzbChpdGVtLmNvbG9yLmludGVycG9sYXRlWzBdLCBpdGVtLmNvbG9yLmludGVycG9sYXRlWzFdKTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHQpIHtcbiAgICAgICAgICB2YXIgY29sb3IgPSBjb2xvckludGVycG9sYXRvcihpdGVtLnBlcmNlbnRhZ2UgLyAxMDApO1xuICAgICAgICAgIGQzLnNlbGVjdCh0aGlzKS5zdHlsZSgnZmlsbCcsIGNvbG9yKTtcbiAgICAgICAgICBkMy5zZWxlY3QodGhpcy5wYXJlbnROb2RlKS5zZWxlY3QoJ3BhdGguYmcnKS5zdHlsZSgnZmlsbCcsIGNvbG9yKTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9KVxuICAgIC5zdHlsZShcImZpbGxcIiwgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgIGlmIChpdGVtLmNvbG9yLnNvbGlkKSB7XG4gICAgICAgIHJldHVybiBpdGVtLmNvbG9yLnNvbGlkO1xuICAgICAgfVxuXG4gICAgICBpZiAoaXRlbS5jb2xvci5saW5lYXJHcmFkaWVudCB8fCBpdGVtLmNvbG9yLnJhZGlhbEdyYWRpZW50KSB7XG4gICAgICAgIHJldHVybiBcInVybCgjZ3JhZGllbnRcIiArIGl0ZW0uaW5kZXggKyAnKSc7XG4gICAgICB9XG4gICAgfSk7XG59O1xuXG4vKipcbiAqIFJlbW92ZSBzdmcgYW5kIGNsZWFuIHNvbWUgcmVmZXJlbmNlc1xuICovXG5SYWRpYWxQcm9ncmVzc0NoYXJ0LnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLnN2Zy5yZW1vdmUoKTtcbiAgZGVsZXRlIHRoaXMuc3ZnO1xufTtcblxuLyoqXG4gKiBEZXRhY2ggYW5kIG5vcm1hbGl6ZSB1c2VyJ3Mgb3B0aW9ucyBpbnB1dC5cbiAqL1xuUmFkaWFsUHJvZ3Jlc3NDaGFydC5ub3JtYWxpemVPcHRpb25zID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgaWYgKCFvcHRpb25zIHx8IHR5cGVvZiBvcHRpb25zICE9PSAnb2JqZWN0Jykge1xuICAgIG9wdGlvbnMgPSB7fTtcbiAgfVxuXG4gIHZhciBfb3B0aW9ucyA9IHtcbiAgICBkaWFtZXRlcjogb3B0aW9ucy5kaWFtZXRlciB8fCAxMDAsXG4gICAgc3Ryb2tlOiB7XG4gICAgICB3aWR0aDogb3B0aW9ucy5zdHJva2UgJiYgb3B0aW9ucy5zdHJva2Uud2lkdGggfHwgNDAsXG4gICAgICBnYXA6IG9wdGlvbnMuc3Ryb2tlICYmIG9wdGlvbnMuc3Ryb2tlLmdhcCB8fCAyXG4gICAgfSxcbiAgICBzaGFkb3c6IHtcbiAgICAgIHdpZHRoOiAoIW9wdGlvbnMuc2hhZG93IHx8IG9wdGlvbnMuc2hhZG93LndpZHRoID09PSBudWxsKSA/IDQgOiBvcHRpb25zLnNoYWRvdy53aWR0aFxuICAgIH0sXG4gICAgYW5pbWF0aW9uOiB7XG4gICAgICBkdXJhdGlvbjogb3B0aW9ucy5hbmltYXRpb24gJiYgb3B0aW9ucy5hbmltYXRpb24uZHVyYXRpb24gfHwgMTc1MCxcbiAgICAgIGRlbGF5OiBvcHRpb25zLmFuaW1hdGlvbiAmJiBvcHRpb25zLmFuaW1hdGlvbi5kZWxheSB8fCAyMDBcbiAgICB9LFxuICAgIG1pbjogb3B0aW9ucy5taW4gfHwgMCxcbiAgICBtYXg6IG9wdGlvbnMubWF4IHx8IDEwMCxcbiAgICByb3VuZDogb3B0aW9ucy5yb3VuZCAhPT0gdW5kZWZpbmVkID8gISFvcHRpb25zLnJvdW5kIDogdHJ1ZSxcbiAgICBzZXJpZXM6IG9wdGlvbnMuc2VyaWVzIHx8IFtdLFxuICAgIGNlbnRlcjogUmFkaWFsUHJvZ3Jlc3NDaGFydC5ub3JtYWxpemVDZW50ZXIob3B0aW9ucy5jZW50ZXIpXG4gIH07XG5cbiAgdmFyIGRlZmF1bHRDb2xvcnNJdGVyYXRvciA9IG5ldyBSYWRpYWxQcm9ncmVzc0NoYXJ0LkNvbG9yc0l0ZXJhdG9yKCk7XG4gIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBfb3B0aW9ucy5zZXJpZXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgaXRlbSA9IG9wdGlvbnMuc2VyaWVzW2ldO1xuXG4gICAgLy8gY29udmVydCBudW1iZXIgdG8gb2JqZWN0XG4gICAgaWYgKHR5cGVvZiBpdGVtID09PSAnbnVtYmVyJykge1xuICAgICAgaXRlbSA9IHt2YWx1ZTogaXRlbX07XG4gICAgfVxuXG4gICAgX29wdGlvbnMuc2VyaWVzW2ldID0ge1xuICAgICAgaW5kZXg6IGksXG4gICAgICB2YWx1ZTogaXRlbS52YWx1ZSxcbiAgICAgIGxhYmVsU3RhcnQ6IGl0ZW0ubGFiZWxTdGFydCxcbiAgICAgIGNvbG9yOiBSYWRpYWxQcm9ncmVzc0NoYXJ0Lm5vcm1hbGl6ZUNvbG9yKGl0ZW0uY29sb3IsIGRlZmF1bHRDb2xvcnNJdGVyYXRvcilcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIF9vcHRpb25zO1xufTtcblxuLyoqXG4gKiBOb3JtYWxpemUgZGlmZmVyZW50IG5vdGF0aW9ucyBvZiBjb2xvciBwcm9wZXJ0eVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfEFycmF5fE9iamVjdH0gY29sb3JcbiAqIEBleGFtcGxlICcjZmUwOGI1J1xuICogQGV4YW1wbGUgeyBzb2xpZDogJyNmZTA4YjUnLCBiYWNrZ3JvdW5kOiAnIzAwMDAwMCcgfVxuICogQGV4YW1wbGUgWycjMDAwMDAwJywgJyNmZjAwMDAnXVxuICogQGV4YW1wbGUge1xuICAgICAgICAgICAgICAgIGxpbmVhckdyYWRpZW50OiB7IHgxOiAnMCUnLCB5MTogJzEwMCUnLCB4MjogJzUwJScsIHkyOiAnMCUnfSxcbiAgICAgICAgICAgICAgICBzdG9wczogW1xuICAgICAgICAgICAgICAgICAge29mZnNldDogJzAlJywgJ3N0b3AtY29sb3InOiAnI2ZlMDhiNScsICdzdG9wLW9wYWNpdHknOiAxfSxcbiAgICAgICAgICAgICAgICAgIHtvZmZzZXQ6ICcxMDAlJywgJ3N0b3AtY29sb3InOiAnI2ZmMTQxMCcsICdzdG9wLW9wYWNpdHknOiAxfVxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgfVxuICogQGV4YW1wbGUge1xuICAgICAgICAgICAgICAgIHJhZGlhbEdyYWRpZW50OiB7Y3g6ICc2MCcsIGN5OiAnNjAnLCByOiAnNTAnfSxcbiAgICAgICAgICAgICAgICBzdG9wczogW1xuICAgICAgICAgICAgICAgICAge29mZnNldDogJzAlJywgJ3N0b3AtY29sb3InOiAnI2ZlMDhiNScsICdzdG9wLW9wYWNpdHknOiAxfSxcbiAgICAgICAgICAgICAgICAgIHtvZmZzZXQ6ICcxMDAlJywgJ3N0b3AtY29sb3InOiAnI2ZmMTQxMCcsICdzdG9wLW9wYWNpdHknOiAxfVxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgfVxuICpcbiAqL1xuUmFkaWFsUHJvZ3Jlc3NDaGFydC5ub3JtYWxpemVDb2xvciA9IGZ1bmN0aW9uIChjb2xvciwgZGVmYXVsdENvbG9yc0l0ZXJhdG9yKSB7XG5cbiAgaWYgKCFjb2xvcikge1xuICAgIGNvbG9yID0ge3NvbGlkOiBkZWZhdWx0Q29sb3JzSXRlcmF0b3IubmV4dCgpfTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgY29sb3IgPT09ICdzdHJpbmcnKSB7XG4gICAgY29sb3IgPSB7c29saWQ6IGNvbG9yfTtcbiAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGNvbG9yKSkge1xuICAgIGNvbG9yID0ge2ludGVycG9sYXRlOiBjb2xvcn07XG4gIH0gZWxzZSBpZiAodHlwZW9mIGNvbG9yID09PSAnb2JqZWN0Jykge1xuICAgIGlmICghY29sb3Iuc29saWQgJiYgIWNvbG9yLmludGVycG9sYXRlICYmICFjb2xvci5saW5lYXJHcmFkaWVudCAmJiAhY29sb3IucmFkaWFsR3JhZGllbnQpIHtcbiAgICAgIGNvbG9yLnNvbGlkID0gZGVmYXVsdENvbG9yc0l0ZXJhdG9yLm5leHQoKTtcbiAgICB9XG4gIH1cblxuICAvLyBWYWxpZGF0ZSBpbnRlcnBvbGF0ZSBzeW50YXhcbiAgaWYgKGNvbG9yLmludGVycG9sYXRlKSB7XG4gICAgaWYgKGNvbG9yLmludGVycG9sYXRlLmxlbmd0aCAhPT0gMikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnRlcnBvbGF0ZSBhcnJheSBzaG91bGQgY29udGFpbiB0d28gY29sb3JzJyk7XG4gICAgfVxuICB9XG5cbiAgLy8gVmFsaWRhdGUgZ3JhZGllbnQgc3ludGF4XG4gIGlmIChjb2xvci5saW5lYXJHcmFkaWVudCB8fCBjb2xvci5yYWRpYWxHcmFkaWVudCkge1xuICAgIGlmICghY29sb3Iuc3RvcHMgfHwgIUFycmF5LmlzQXJyYXkoY29sb3Iuc3RvcHMpIHx8IGNvbG9yLnN0b3BzLmxlbmd0aCAhPT0gMikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdncmFkaWVudCBzeW50YXggaXMgbWFsZm9ybWVkJyk7XG4gICAgfVxuICB9XG5cbiAgLy8gU2V0IGJhY2tncm91bmQgd2hlbiBpcyBub3QgcHJvdmlkZWRcbiAgaWYgKCFjb2xvci5iYWNrZ3JvdW5kKSB7XG4gICAgaWYgKGNvbG9yLnNvbGlkKSB7XG4gICAgICBjb2xvci5iYWNrZ3JvdW5kID0gY29sb3Iuc29saWQ7XG4gICAgfSBlbHNlIGlmIChjb2xvci5pbnRlcnBvbGF0ZSkge1xuICAgICAgY29sb3IuYmFja2dyb3VuZCA9IGNvbG9yLmludGVycG9sYXRlWzBdO1xuICAgIH0gZWxzZSBpZiAoY29sb3IubGluZWFyR3JhZGllbnQgfHwgY29sb3IucmFkaWFsR3JhZGllbnQpIHtcbiAgICAgIGNvbG9yLmJhY2tncm91bmQgPSBjb2xvci5zdG9wc1swXVsnc3RvcC1jb2xvciddO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBjb2xvcjtcblxufTtcblxuXG4vKipcbiAqIE5vcm1hbGl6ZSBkaWZmZXJlbnQgbm90YXRpb25zIG9mIGNlbnRlciBwcm9wZXJ0eVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfEFycmF5fEZ1bmN0aW9ufE9iamVjdH0gY2VudGVyXG4gKiBAZXhhbXBsZSAnZm9vIGJhcidcbiAqIEBleGFtcGxlIHsgY29udGVudDogJ2ZvbyBiYXInLCB4OiAxMCwgeTogNCB9XG4gKiBAZXhhbXBsZSBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGl0ZW0pIHt9XG4gKiBAZXhhbXBsZSBbJ2ZvbyBiYXInLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGl0ZW0pIHt9XVxuICovXG5SYWRpYWxQcm9ncmVzc0NoYXJ0Lm5vcm1hbGl6ZUNlbnRlciA9IGZ1bmN0aW9uIChjZW50ZXIpIHtcbiAgaWYgKCFjZW50ZXIpIHJldHVybiBudWxsO1xuXG4gIC8vIENvbnZlcnQgdG8gb2JqZWN0IG5vdGF0aW9uXG4gIGlmIChjZW50ZXIuY29uc3RydWN0b3IgIT09IE9iamVjdCkge1xuICAgIGNlbnRlciA9IHtjb250ZW50OiBjZW50ZXJ9O1xuICB9XG5cbiAgLy8gRGVmYXVsdHNcbiAgY2VudGVyLmNvbnRlbnQgPSBjZW50ZXIuY29udGVudCB8fCBbXTtcbiAgY2VudGVyLnggPSBjZW50ZXIueCB8fCAwO1xuICBjZW50ZXIueSA9IGNlbnRlci55IHx8IDA7XG5cbiAgLy8gQ29udmVydCBjb250ZW50IHRvIGFycmF5IG5vdGF0aW9uXG4gIGlmICghQXJyYXkuaXNBcnJheShjZW50ZXIuY29udGVudCkpIHtcbiAgICBjZW50ZXIuY29udGVudCA9IFtjZW50ZXIuY29udGVudF07XG4gIH1cblxuICByZXR1cm4gY2VudGVyO1xufTtcblxuLy8gTGluZWFyIG9yIFJhZGlhbCBHcmFkaWVudCBpbnRlcm5hbCBvYmplY3RcblJhZGlhbFByb2dyZXNzQ2hhcnQuR3JhZGllbnQgPSAoZnVuY3Rpb24gKCkge1xuICBmdW5jdGlvbiBHcmFkaWVudCgpIHtcbiAgfVxuXG4gIEdyYWRpZW50LnRvU1ZHRWxlbWVudCA9IGZ1bmN0aW9uIChpZCwgb3B0aW9ucykge1xuICAgIHZhciBncmFkaWVudFR5cGUgPSBvcHRpb25zLmxpbmVhckdyYWRpZW50ID8gJ2xpbmVhckdyYWRpZW50JyA6ICdyYWRpYWxHcmFkaWVudCc7XG4gICAgdmFyIGdyYWRpZW50ID0gZDMuc2VsZWN0KGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhkMy5ucy5wcmVmaXguc3ZnLCBncmFkaWVudFR5cGUpKVxuICAgICAgLmF0dHIob3B0aW9uc1tncmFkaWVudFR5cGVdKVxuICAgICAgLmF0dHIoJ2lkJywgaWQpO1xuXG4gICAgb3B0aW9ucy5zdG9wcy5mb3JFYWNoKGZ1bmN0aW9uIChzdG9wQXR0cnMpIHtcbiAgICAgIGdyYWRpZW50LmFwcGVuZChcInN2ZzpzdG9wXCIpLmF0dHIoc3RvcEF0dHJzKTtcbiAgICB9KTtcblxuICAgIHRoaXMuYmFja2dyb3VuZCA9IG9wdGlvbnMuc3RvcHNbMF1bJ3N0b3AtY29sb3InXTtcblxuICAgIHJldHVybiBncmFkaWVudC5ub2RlKCk7XG4gIH07XG5cbiAgcmV0dXJuIEdyYWRpZW50O1xufSkoKTtcblxuLy8gRGVmYXVsdCBjb2xvcnMgaXRlcmF0b3JcblJhZGlhbFByb2dyZXNzQ2hhcnQuQ29sb3JzSXRlcmF0b3IgPSAoZnVuY3Rpb24gKCkge1xuXG4gIENvbG9yc0l0ZXJhdG9yLkRFRkFVTFRfQ09MT1JTID0gW1wiIzFhZDVkZVwiLCBcIiNhMGZmMDNcIiwgXCIjZTkwYjNhXCIsICcjZmY5NTAwJywgJyMwMDdhZmYnLCAnI2ZmY2MwMCcsICcjNTg1NmQ2JywgJyM4ZThlOTMnXTtcblxuICBmdW5jdGlvbiBDb2xvcnNJdGVyYXRvcigpIHtcbiAgICB0aGlzLmluZGV4ID0gMDtcbiAgfVxuXG4gIENvbG9yc0l0ZXJhdG9yLnByb3RvdHlwZS5uZXh0ID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLmluZGV4ID09PSBDb2xvcnNJdGVyYXRvci5ERUZBVUxUX0NPTE9SUy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuaW5kZXggPSAwO1xuICAgIH1cblxuICAgIHJldHVybiBDb2xvcnNJdGVyYXRvci5ERUZBVUxUX0NPTE9SU1t0aGlzLmluZGV4KytdO1xuICB9O1xuXG4gIHJldHVybiBDb2xvcnNJdGVyYXRvcjtcbn0pKCk7XG5cblxuLy8gRXhwb3J0IFJhZGlhbFByb2dyZXNzQ2hhcnQgb2JqZWN0XG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiltb2R1bGUuZXhwb3J0cyA9IFJhZGlhbFByb2dyZXNzQ2hhcnQ7Il19
