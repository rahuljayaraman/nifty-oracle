var irc = require('irc');
var request = require('request');
var Q = require('q');
var config = require('./bot_config');
var logger = require('winston');
var moment = require('moment');

if (process.env.REDISTOGO_URL) {
	var rtg   = require("url").parse(process.env.REDISTOGO_URL);
	var redis = require("redis").createClient(rtg.port, rtg.hostname);
	redis.auth(rtg.auth.split(":")[1]);
} else {
	var redis = require("redis").createClient();
}

SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']; 
BASE_URL = "http://www.horoscopecloud.com/api/v1.0/horoscope/";
COMMANDS = ['!links'];

var client = new irc.Client(config.server, config.name, {
	channels: [config.channel],
	messageSplit: 1000,
	floodProtection: false,
	autoRejoin: true,
	autoConnect: true
});

client.addListener('message', function (from, to, message) {
	//Log Links
	var link = hasLink(message);
	if (link) {
		saveLink(from, to, message, link, moment().format());
	}

	parseLinksCommand(message);

	//Look for Horoscope references
	var keyword = findKeyWord(message);
	if(keyword) {
		logger.info("From:", from);
		fetchHoroscopeFor(keyword).then(rant).fail(handleError);
	}
});

client.addListener('error', function(message) {
	logger.error(message);
});


var parseLinksCommand = function(message) {
	var regExp = new RegExp("^!links\\s{0,2}\\d{0,2}");
	var command = message.match(regExp);
	if (command) {
		sendLinks(command[0]);
	}
	return;
}

var sendLinks = function(command) {
	var argument = command.split(" ", 2);
	var nos = argument[1] || "10";
	if (nos != "10") {
		//Array offset. Subtract 1 to range
		nos = (parseInt(nos) - 1).toString();
	}
	console.log(nos);
	var args = ['bot:logs:links', '0', nos];
	redis.lrange(args, function(err, res) {
		res.forEach(function(entry) {
			var json = JSON.parse(entry);
			var message = json.link;
			rant(message);
		});
	});
}

var saveLink = function(from, to, message, link, datetime) {
	var entry = {
		from: from,
		to: to,
		message: message,
		link: link,
		datetime: datetime
	};
	redis.lpush("bot:logs:links", JSON.stringify(entry));
}

var hasLink = function(message) {
	var regExp = /http[s]?:\/\/[^\s]*/;
	var match = message.match(regExp);
	if (match == null) {
		return null;
	}
	return match[0];
}

var findKeyWord = function(message) {
	var reg = new RegExp(SIGNS.join('|'), "i");
	var result = reg.exec(message);
	if(result) {
		return result[0];
	} else {
		return null;
	}
}

var fetchHoroscopeFor = function(keyword) {
	var url = BASE_URL + keyword;
	var deferred = Q.defer();
	request(url, function(err, response, body) {
		if (!err && response.statusCode == 200) {
			deferred.resolve(chooseRandomHoroscopeFrom(JSON.parse(body).reading));
		} else {
			deferred.reject(new Error(err));
		}
	});
	return deferred.promise;
}

var chooseRandomHoroscopeFrom = function(readings) {
	var horoscopes = [];
	for(var provider in readings) {
		var invalid = /date|kajama/i.exec(provider);
		if (invalid == null) {
			horoscopes.push(provider + ": " + sanitize(readings[provider]));
		}
	}
	return horoscopes[Math.floor(Math.random() * horoscopes.length)];
}

var rant = function(message) {
	logger.info(message);
	client.say(config.channel, message);
}

var handleError = function(error) {
	logger.error(error);
	rant("Hmm.. Your future is clouded. Allow me to medidate. I'll get back to you.");
}

var sanitize = function(message) {
	return message.replace(/(\r\n|\n|\r)/gm,"");
}
