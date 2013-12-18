module.exports.parse = function(message) {
	var links = /^links\s{0,2}\d{0,2}/;
	var horoscope = /^ho\s{1}\w{0,15}/;

	if(links.test(message)) {
		return { module: "links", action: message };
	} else if (horoscope.test(message)) {
		return { module: "horoscope", action: message };
	} else {
		return { module: "notfound" }
	}
}
