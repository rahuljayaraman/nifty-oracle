var irc = require('irc');
var Q = require('q');
var config = require('./bot_config');
var logger = require('winston');
var moment = require('moment');
var _ = require('underscore');

//RedisToGo for Heroku
if (process.env.REDISTOGO_URL) {
	var rtg   = require("url").parse(process.env.REDISTOGO_URL);
	var redis = require("redis").createClient(rtg.port, rtg.hostname);
	redis.auth(rtg.auth.split(":")[1]);
} else {
	var redis = require("redis").createClient();
}

//This is fucked up. Must find a better solution
var args = ['bot:logs:links', '0', '1000'];
var users = [];
redis.lrange(args, function(err, res) {
	if(err) throw err;
	res.forEach(function(message) {
		var user = JSON.parse(message).from;
		if (!_.contains(users, user)) {
			users.push(user);
		}
	});
});

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
		var module = Commander.parse(command[1], from);
		router(module);
	}
});

client.addListener('error', function(message) {
	logger.error(message);
});


var router = function(command) {
	switch(command.module) {
		case "publinks":
			handleLinks(command, true);
			break;
		case "links":
			handleLinks(command, false);
			break;
		case "horoscope":
			handleHoroscopes(command.action);
			break;
		case "help":
			handleHelp();
			break;
		case "all":
			handleAll(command.from);
			break;
		default:
			handleDefault();
			break;	
	}
}

var handleLinks = function(command, public) {
	var action = command.action;

	linkLogger.getLinks(action).then(function(response) { 
		response.forEach(function(entry) {
			var json = JSON.parse(entry);
			var message = json.from + "(" + moment(json.datetime).fromNow() + "): " + json.link;
			if (public) {
				rant(message);
			} else {
				rant(message, command.from);
			}
		});
	}).fail();
}

var handleHoroscopes = function(action) {
	var keyword = horoscope.findKeyWord(action.split(' ')[1]);
	if(keyword) {
		horoscope.fetchHoroscopeFor(keyword).then(rant).fail(handleError);
	} else {
		rant("There's a disturbance in the ether? It's either that or you misspelt something..");
	}
}

var rant = function(message, from) {
	logger.info(message);
	if (from) {
		client.say(from, message);
	} else {
		client.say(config.channel, message);
	}
}

var handleAll = function (from) {
	var message = from + " has something to say";
	rant(message + " : " + users.join(" "));
}

var handleDefault = function() {
	rant("Hmm.. What are you trying to say? Maybe try !help for a list of commands");
}

var handleHelp = function() {
	logger.info(client._whoisData);
	rant("!links, !links 1..25, !publinks 1..25, !all, !ho *sunsign*");
}

var handleError = function(error) {
	logger.error(error);
	rant("Hmm.. Your future is clouded. Allow me to medidate. I'll get back to you.");
}
