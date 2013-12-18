var Q = require('q');
var request = require('request');

SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']; 
BASE_URL = "http://www.horoscopecloud.com/api/v1.0/horoscope/";

module.exports.findKeyWord = function(message) {
	var reg = new RegExp(SIGNS.join('|'), "i");
	var result = reg.exec(message);
	if(result) {
		return result[0];
	} else {
		return null;
	}
}

module.exports.fetchHoroscopeFor = function(keyword) {
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

var sanitize = function(message) {
	return message.replace(/(\r\n|\n|\r)/gm,"");
}
