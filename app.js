var irc = require('irc');
var Q = require('q');
var config = require('./bot_config');
var logger = require('winston');
var moment = require('moment');

//RedisToGo for Heroku
if (process.env.REDISTOGO_URL) {
	var rtg   = require("url").parse(process.env.REDISTOGO_URL);
	var redis = require("redis").createClient(rtg.port, rtg.hostname);
	redis.auth(rtg.auth.split(":")[1]);
} else {
	var redis = require("redis").createClient();
}

var linkLogger = require('./link_logger')(redis);
var Commander = require('./commander');
var horoscope = require('./horoscope');


var client = new irc.Client(config.server, config.name, {
	channels: [config.channel],
	messageSplit: 1000,
	floodProtection: false,
	autoRejoin: true,
	autoConnect: true
});

client.addListener('message', function (from, to, message) {
	//Log Links
	var link = linkLogger.hasLink(message);
	if (link) {
		linkLogger.saveLink(from, to, message, link, moment().format());
	}

	//Look for commands
	var regExp = /^!(.+)/;
	var command = regExp.exec(message);
	if(command) {
		var module = Commander.parse(command[1]);
		router(module);
	}
});

client.addListener('error', function(message) {
	logger.error(message);
});


var router = function(command) {
	switch(command.module) {
		case "links":
			handleLinks(command.action);
			break;
		case "horoscope":
			handleHoroscopes(command.action);
			break;
		default:
			handleDefault();
			break;	
	}
}

var handleLinks = function(action) {
	linkLogger.getLinks(action).then(function(response) { 
		response.forEach(function(entry) {
			var json = JSON.parse(entry);
			var message = json.from + "(" + moment(json.datetime).fromNow() + "): " + json.link;
			rant(message) 
		});
	}).fail();
}

var handleHoroscopes = function(action) {
	var keyword = horoscope.findKeyWord(action.split(' ')[1]);
	if(keyword) {
		horoscope.fetchHoroscopeFor(keyword).then(rant).fail(handleError);
	} else {
		rant("Were you born on another planet? It's either that or you misspelt something..");
	}
}

var rant = function(message) {
	logger.info(message);
	client.say(config.channel, message);
}

var handleDefault = function() {
	rant("Hmm.. What are you trying to say?");
}

var handleError = function(error) {
	logger.error(error);
	rant("Hmm.. Your future is clouded. Allow me to medidate. I'll get back to you.");
}
