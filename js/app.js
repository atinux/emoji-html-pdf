var spawn = require('child_process').spawn;
var gui = require('nw.gui');
var pdf = require('html-pdf');
var emoji = require('emoji-parser');
// https://github.com/frissdiegurke/emoji-parser
emoji.init('./img/emoji').update();
// listing of emojis: http://www.emoji-cheat-sheet.com/
// Get application path
var win = gui.Window.get();
var path = win.window.location.protocol + '//' + win.window.location.pathname.slice(0, win.window.location.pathname.lastIndexOf('/'));

function toPDF() {
	$('#export').html('Saving...').attr('disabled', 'disabled');
	var html = win.window.document.documentElement.outerHTML;
	// https://github.com/marcbachmann/node-html-pdf
	var options = {
		// Papersize Options: http://phantomjs.org/api/webpage/property/paper-size.html
		width: '120mm', // allowed units: mm, cm, in, px
		height: '150mm', // allowed units: mm, cm, in, px
		orientation: 'portrait', // or landscape
		// Page options
		border: '10mm', // default is 0, units: mm, cm, in, px
		// header: {
		// 	height: '10mm',
		// 	contents: '<div style="text-align: center;border-bottom: 1px #ddd solid;">Author: Chopin brothers</div>',
		// },
		footer: {
			height: '15mm',
			contents: '<div style="text-align: center;padding-top: 20px;">{{page}}</div>',
		},
		// File options
		type: 'pdf',
		// Export options
		filename: './files/output.pdf',
	};
	// Compatibility CSS path
	html = html.replace(/css\/(.+)\.css/g, path + '/css/$1.css');
	// Remove scripts
	html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
	// Emoji paths
	// html = emoji.parse(html, path + '/img/emoji');
	// Create PDF
	pdf.create(html, options, function (err, res) {
		// console.log(err, res);
		// alert('Done!');
		$('#export').html('Save in PDF').removeAttr('disabled');
		var child = spawn('open', [ options.filename ]);
		setTimeout(function() {
			child.kill();
		}, 1000);
		// child.stdout.on('data', function (buffer) { console.log(buffer.toString()); });
		// child.stderr.on('data', function (buffer) { console.log(buffer.toString()); });
		// child.on('exit', function () { console.log('Open exited!', arguments); });
	});
}

// Special client-side
$(function () {
	$body = $('body');
	$body.html(window.emojiParser($body.html(), path + '/img/emoji'));
	// toPDF();
});
