module.exports.parse = function(message, from) {
	var publinks = /^publinks\s{0,2}\d{0,2}/;
	var links = /^links\s{0,2}\d{0,2}/;
	var horoscope = /^ho\s{1}\w{0,15}/;
	var help = /help/i;
	var all = /all/i;
	var asana = /asana/i;

	if(publinks.test(message)) {
		return { module: "publinks", action: message, from: from };
	} else if (links.test(message)) {
		return { module: "links", action: message, from: from };
	} else if (horoscope.test(message)) {
		return { module: "horoscope", action: message, from: from };
	} else if (help.test(message)) {
		return { module: "help", action: message, from: from };
	} else if (all.test(message)) {
		return { module: "all", action: message, from: from };
	} else if (asana.test(message)) {
		return { module: "asana", action: message, from: from };
	} else {
		return { module: "notfound" }
	}
}
