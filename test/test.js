var assert = require('assert');
var RadialProgressChart = require('../index.js');

describe('RadialProgressChart', function () {

  describe('Normalize options', function () {

    describe('Defaults', function () {

      it('should return default options', function () {
        var options = RadialProgressChart.normalizeOptions();

        assert(options.diameter == 100);
        assert(options.stroke.width == 40);
        assert(options.stroke.gap == 2);
        assert(options.animation.duration == 1750);
        assert(options.animation.delay == 200);
        assert(options.min == 0);
        assert(options.max == 100);
        assert(options.series.length == 0);
      });

      it('should merge options with default options', function () {
        var input = {
          stroke: {
            gap: 5
          },
          min: 50
        };

        var options = RadialProgressChart.normalizeOptions(input);

        assert(options.diameter == 100);
        assert(options.stroke.width == 40);
        assert(options.stroke.gap == 5);
        assert(options.animation.duration == 1750);
        assert(options.animation.delay == 200);
        assert(options.min == 50);
        assert(options.max == 100);
        assert(options.series.length == 0);
      });

    });

    describe('Series', function () {

      it('should normalize series array', function () {
        var input = {series: [10, 15, 5]};
        var options = RadialProgressChart.normalizeOptions(input);

        assert(options.series[0].value == 10);
        assert(options.series[1].value == 15);
        assert(options.series[2].value == 5);

        assert(options.series[0].index == 0);
        assert(options.series[1].index == 1);
        assert(options.series[2].index == 2);
      });

    });


    describe('Colors', function () {

      var DEFAULT_COLORS = RadialProgressChart.ColorsIterator.DEFAULT_COLORS;

      it('should add default color and background to the series', function () {
        var input = {series: [10, 15, 5]};
        var options = RadialProgressChart.normalizeOptions(input);

        assert(options.series[0].color.solid == DEFAULT_COLORS[0]);
        assert(options.series[1].color.solid == DEFAULT_COLORS[1]);
        assert(options.series[2].color.solid == DEFAULT_COLORS[2]);

        assert(options.series[0].color.background == DEFAULT_COLORS[0]);
        assert(options.series[1].color.background == DEFAULT_COLORS[1]);
        assert(options.series[2].color.background == DEFAULT_COLORS[2]);
      });

      it('should normalize different notations for solid color', function () {
        var input = {
          series: [
            {
            },
            {
              color: 'red'
            },
            {
              color: {
                solid: '#fe08b5'
              }
            }
          ]};
        var options = RadialProgressChart.normalizeOptions(input);


        assert.equal(options.series[0].color.solid, DEFAULT_COLORS[0]);
        assert.equal(options.series[1].color.solid, 'red');
        assert.equal(options.series[2].color.solid, '#fe08b5');

      });

      it('should normalize different notations for interpolate color', function () {
        var input = {
          series: [
            {
              color: ['#000000', '#ff0000']
            },
            {
              color: {
                interpolate: ['#000000', '#ff0000']
              }
            }
          ]};
        var options = RadialProgressChart.normalizeOptions(input);

        var i = 0;
        assert.deepEqual(options.series[i++].color.interpolate, ['#000000', '#ff0000']);
        assert.deepEqual(options.series[i++].color.interpolate, ['#000000', '#ff0000']);
      });

      it('should set background color when is not provided', function () {
        var input = {
          series: [
            {
              value: 10
            },
            {
              value: 15,
              color: {
                solid: '#fe08b5'
              }
            },
            {
              value: 5,
              color: ['#000000', '#ff0000']
            },
            {
              value: 2,
              color: {
                linearGradient: { x1: '0%', y1: '100%', x2: '50%', y2: '0%'},
                stops: [
                  {offset: '0%', 'stop-color': '#fe08b5', 'stop-opacity': 1},
                  {offset: '100%', 'stop-color': '#ff1410', 'stop-opacity': 1}
                ]
              }
            },
            {
              value: 4,
              color: {
                radialGradient: {cx: '60', cy: '60', r: '50'},
                stops: [
                  {offset: '0%', 'stop-color': '#fe08b5', 'stop-opacity': 1},
                  {offset: '100%', 'stop-color': '#ff1410', 'stop-opacity': 1}
                ]
              }
            },
            {
              value: 15,
              color: {
                solid: '#fe08b5',
                background: 'red'
              }
            }

          ]};
        var options = RadialProgressChart.normalizeOptions(input);

        assert.equal(options.series[0].color.background, RadialProgressChart.ColorsIterator.DEFAULT_COLORS[0]);
        assert.equal(options.series[1].color.background, '#fe08b5');
        assert.equal(options.series[2].color.background, '#000000');
        assert.equal(options.series[3].color.background, '#fe08b5');
        assert.equal(options.series[4].color.background, '#fe08b5');
        assert.equal(options.series[5].color.background, 'red');
      });

    });

    describe('Center', function () {

      it('should normalize different notations for center property', function () {
        var options = RadialProgressChart.normalizeOptions({center: 'PROGRESS'});
        assert.deepEqual(options.center.content, ['PROGRESS']);
        assert.equal(options.center.x, 0);
        assert.equal(options.center.y, 0);

        options = RadialProgressChart.normalizeOptions({center: {content: 'PROGRESS' , y: -10}});
        assert.deepEqual(options.center.content, ['PROGRESS']);
        assert.equal(options.center.x, 0);
        assert.equal(options.center.y, -10);

        options = RadialProgressChart.normalizeOptions({center: function(x){}});
        assert.equal(typeof options.center.content[0], 'function');

        options = RadialProgressChart.normalizeOptions({center: ['300', 'of 1000 cals']});
        assert.deepEqual(options.center.content, ['300', 'of 1000 cals']);
        assert.equal(options.center.x, 0);
        assert.equal(options.center.y, 0);
      });
    });
  });
});