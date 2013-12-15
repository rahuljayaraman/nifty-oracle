var irc = require('irc');
var request = require('request');
var Q = require('q');
var config = require('./bot_config');
var logger = require('winston');

SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']; 
BASE_URL = "http://www.horoscopecloud.com/api/v1.0/horoscope/";

var client = new irc.Client(config.server, config.name, {
	channels: [config.channel],
	messageSplit: 1000,
	floodProtection: false,
	autoRejoin: true,
	autoConnect: true
});

client.addListener('message', function (from, to, message) {
	logger.info("From:", from);
	var keyword = findKeyWord(message);
	if(keyword) {
		fetchHoroscopeFor(keyword).then(rant).fail(handleError);
	}
});

client.addListener('error', function(message) {
	logger.error(message);
});

var findKeyWord = function(message) {
	var reg = new RegExp( SIGNS.join('|'), "i");
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
