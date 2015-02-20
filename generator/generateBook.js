/*
** Special config MLSG
*/
var configService = {
	//MAX_SMS_PER_BOOK : 1000,
	MAX_SMS_PER_BOOK : 4000,
	workspace_dir : 'workspace',
	workspace: {
		pdf_dir: 'generator/workspace/pdf/',
		csv_dir:'generator/workspace/csv/',
		zip_dir:'generator/workspace/zip/'
	},
	MONTH: [
		"Janvier",
		"F\u00e9vrier",
		"Mars",
		"Avril",
		"Mai",
		"Juin",
		"Juillet",
		"Ao\u00fbt",
		"Septembre",
		"Octobre",
		"Novembre",
		"D\u00e9cembre"
	],
	police : {
		textSize : 11,
		textFont : 'Times-Roman',
		boldFont : 'Times-Bold',
		mounthSize : 28,
		width: 383, // 135 mm = 5,4 * 2,5 cm = 5,4 * 1 inch = 5,4 * 72 points = 388,8
		height: 539, // 190mm = 547,2 points + 20mm (57,6 pts) => 604,8
		margin : 70, // 25mm = 45
		alinea : 30

	},
	printer : {
		coupe : 15,
		stop : 5
	},
	cover : {
		fond: 29, // 1cm = 0,4 * 72 pts = 29
		coupe: 20,
		tranche: 0.17, // 0,6 mm
		hauteur: 547, // 19 cm = 7,6 * 2,5cm => 7,6 * 72 pts = 547.2
		largeur: 389 // 13,5 cm = 5,4 * 2,5cm => 5,4 * 72 pts = 388.8
	}
};
var idClient = 318;

var constructClientFromCSV = function (idClient, success, failure) {
	var csvDataIn = configService.workspace.csv_dir + idClient+'/data.csv' ;
	var client = {};
	client.idClient = idClient;
	if (fs.existsSync(csvDataIn)) {
		var csv = require('csv');
		csv()
		.from.path(csvDataIn, { delimiter: ';', escape: '"',encoding: 'utf8' })

		.on('record', function(row){
			client.email = row[0];
			client.fullName = decodeURIComponent(row[1]).replace(/ +/g, ' ');
			client.from =  decodeURIComponent(row[2]);
			client.to =  decodeURIComponent(row[3]);
			client.nbSMS =  row[4];
			client.cover =  (row[5]) ? row[5] : '';
			client.emoji =  (row[6]) ? row[6] : '';
			client.resume =  (row[7]) ? decodeURIComponent(row[7]) : '';
			client.reference =  (row[8]) ? row[8] : '';
			success(client);
		}).on('end', function(){

		}).on('error', function(error){
			failure(error.message);
		});
	} else {
		failure('data.csv est inexistant');
	}
};
var initBookOptions = function(client){
	return {
		idClient: client.idClient,
		firstDates: [],
		lastDates: [],
		from: client.from,
		to: client.to,
		cover: client.cover,
		emoji: client.emoji,
		resume: client.resume,
		pages: [],
		sizes: {
			width: configService.police.width,
			height: configService.police.height,
			margin: configService.police.margin,
		},
	};
};

var createDocForBook = function(index, bookOptions){
	var PDFDocument = require('pdfkit');
	var doc = new PDFDocument({
		size: [configService.police.width, configService.police.height],
		margin: configService.police.margin,
		bufferPages: true
	});
	doc.info['Title'] = 'MonLivreSMS';
	doc.info['Author'] = 'MonLivreSMS.com';

	if (!fs.existsSync(configService.workspace.pdf_dir)) {
		fs.mkdirSync(configService.workspace.pdf_dir);
	}
	if (!fs.existsSync(configService.workspace.pdf_dir + bookOptions.idClient)) {
		fs.mkdirSync(configService.workspace.pdf_dir + bookOptions.idClient);
	}
	if (fs.existsSync(configService.workspace.pdf_dir + bookOptions.idClient + '/Client'+bookOptions.idClient+'-' +(index+1)+ '.pdf')) {
		fs.unlinkSync(configService.workspace.pdf_dir + bookOptions.idClient + '/Client'+bookOptions.idClient+'-' +(index+1)+ '.pdf');
	}
	var writeStream = fs.createWriteStream(configService.workspace.pdf_dir + bookOptions.idClient + '/Client'+bookOptions.idClient+'-' +(index+1)+ '.pdf');
	doc.pipe(writeStream);
	return doc;
};

var addFirstPage = function (doc, client) {
	doc.moveDown(6)
	.fontSize(configService.police.mounthSize)
	.font(configService.police.boldFont)
	.fillColor('#000000')
	.text(client.to, {align:'center'})
	.fillColor('#868786')
	.text('& ' + client.from, {align:'center'})
	.moveDown(3)
	.image('images/logo.png', (configService.police.width * 0.3),doc.y, {width: configService.police.width * 0.4});
	doc.image('images/1.png', configService.police.width/2 + 4, configService.police.height*0.95, {width:4}).addPage();
	doc.image('images/2.png', configService.police.width/2 + 4, configService.police.height*0.95, {width:4}).addPage();
	doc.image('images/3.png', configService.police.width/2 + 4, configService.police.height*0.95, {width:4}).addPage();
	doc.image('images/4.png', configService.police.width/2 + 4, configService.police.height*0.95, {width:4});
};

/*
** Real code!
*/

var gui = require('nw.gui');
var win = gui.Window.get();
var path = win.window.location.protocol + '//' + win.window.location.pathname.slice(0, win.window.location.pathname.lastIndexOf('/'));
var pdf = require('html-pdf');
var ejs = require('ejs');
var async = require('async');
var moment = require('moment');
var fs = require('fs');
var emojify = require('emojify.js');
var emojiStrip = require('emoji-strip');
var EmojiData = require('emoji-data');
// emojify.setConfig({
// 	img_dir: path + '/images/emoji',
// });

constructClientFromCSV(idClient, function (client) {
	var csvName = configService.workspace.csv_dir + client.idClient+'/export.csv';
	var csv = require('csv');
	var SMSCounter = 0;
	var nbBooks = Math.ceil(client.nbSMS/configService.MAX_SMS_PER_BOOK); // Ne depasse pas la limite
	var smsPerBook = Math.ceil(client.nbSMS/nbBooks); // Equilibre les livres
	var previousPageNumber = 0;
	var oldDate = null;
	var recordDate = new Date();
	var bookOptions = initBookOptions(client);
	bookOptions.title = 'MonLivreSMS';
	bookOptions.author = 'MonLivreSMS.com';
	var allMessages = [];

	csv().from.path(csvName, { delimiter: ';' })
	.on('record', function (row, index) {
		var message = decodeURIComponent(row[3]);
		message = message.replace(/(<([^>]+)>)/ig, ''); // Strip HTML tags
		if (client.emoji === 'oui') {
			EmojiData.scan(message).forEach(function (ec) {
				if (!ec) return;
				message = message.replace(EmojiData.unified_to_char(ec.unified), ':'+ec.short_name+':');
			});
			message = decodeURI(encodeURI(message).replace(/%EF%B8%8F/g, ''));
			message = emojify.replace(message);
		} else {
			message = emojiStrip(message);
		}
		var date = moment(row[0], 'YYYY-MM-DD HH:mm:ss');
		allMessages.push({
			date: date.toISOString(),
			month: date.format('YYYY-MM'),
			day: date.format('YYYY-MM-DD'),
			dateDisplay: date.format('D') + ' ' + configService.MONTH[date.month()] + ' ' + date.year(),
			monthDisplay: configService.MONTH[date.month()] + ' ' + date.year(),
			dayDisplay: date.format('D') + ' ' +configService.MONTH[date.month()],
			from: row[1],
			to: row[2],
			body: message
		});
	})
	.on('end', function (count) {
		// Generate books
		var template = fs.readFileSync('generator/book.ejs', 'utf8');
		async.timesSeries(nbBooks, function (i, next) {
			console.log('Generate book ['+i+']');
			var messages = allMessages.slice(i * smsPerBook, i * smsPerBook + smsPerBook);
			bookOptions.firstDates[i] = messages[0].dateDisplay;
			bookOptions.lastDates[i] = messages[messages.length - 1].dateDisplay;
			var html = ejs.render(template, {
				client: client,
				book: bookOptions,
				messages: messages,
				path: path,
			});
			var filename = configService.workspace.pdf_dir + bookOptions.idClient + '/Client'+bookOptions.idClient+'-' + (i + 1) + '.pdf';
			$('body').html(html);
			// html = html.replace(/css\/(.+)\.css/g, path + '/css/$1.css'); // Absolute path for CSS
			// html = html.replace(/js\/libs\/(.+)\.js/g, path + '/js/libs/$1.js'); // Absolute path for JS
			// html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ''); // Remove scripts
			var options = {
				// Papersize Options: http://phantomjs.org/api/webpage/property/paper-size.html
				// width: (configService.police.width + configService.police.margin) + 'px', // 135mm, allowed units: mm, cm, in, px
				width: '135mm', // 135mm, allowed units: mm, cm, in, px
				height: '190mm', // 190mm, allowed units: mm, cm, in, px
				orientation: 'portrait', // or landscape
				// Page options
				border: '5mm', // default is 0, units: mm, cm, in, px
				// header: {
				// 	height: '10mm',
				// 	contents: '<div style="text-align: center;border-bottom: 1px #ddd solid;">Author: Chopin brothers</div>',
				// },
				footer: {
					height: '5mm',
					contents: '<div style="text-align: center;font-size: 12px;">{{page}}</div>',
				},
				// File options
				type: 'pdf',
				quality: 100,
				// Export options
				filename: filename,
				script: './generator/htmlToPDF.js',
			};
			pdf.create(html, options, function (err, res) {
				console.log(err, (res && !res.filename ? res.toString() : res));
				bookOptions.pages[i] = res.pages || 0;
				// win.window.open(filename);
				next();
			});
		}, function (err, books) {
			console.log('Finished', err, books);
		});
	})
	.on('error', function(error){
		console.log(error.message);
	});
}, console.log.bind(console, 'Error'));