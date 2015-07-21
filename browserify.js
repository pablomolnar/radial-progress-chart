'use strict';

var fs = require('fs');
var browserify = require('browserify');

if (!fs.existsSync('./dist')) {
  fs.mkdirSync('./dist');
}

browserify({'debug': true, 'standalone': 'Radial Progress Chart'})
  .require('./index.js', {'entry': true})
  .exclude('d3')
  .bundle()
  .on('error', function(err) { console.log('Error : ' + err.message); })
  .pipe(fs.createWriteStream('dist/radial-progress-chart.js'));