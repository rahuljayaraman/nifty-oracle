var Q = require('q');

module.exports = function(redis) {

	var linkCommands = {};

	linkCommands.saveLink = function(from, to, message, link, datetime) {
		var entry = {
			from: from,
			to: to,
			message: message,
			link: link,
			datetime: datetime
		};
		redis.lpush("bot:logs:links", JSON.stringify(entry));
	}

	linkCommands.hasLink = function(message) {
		var regExp = /http[s]?:\/\/[^\s]*/;
		var match = message.match(regExp);
		if (match == null) {
			return null;
		}
		return match[0];
	}

	linkCommands.getLinks = function(command) {
		var deferred = Q.defer();

		var argument = command.split(" ", 2);
		var nos = argument[1] || "10";
		if (nos != "10") {
			//Array offset. Subtract 1 to range
			nos = (parseInt(nos) - 1).toString();
		}
		var args = ['bot:logs:links', '0', nos];
		redis.lrange(args, function(err, res) {
			if(err) deferred.reject(new Error(err));
			deferred.resolve(res);
		});

		return deferred.promise;
	}

	return linkCommands;
}
