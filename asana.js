var request = require('request');
var Q = require('q');
var moment = require('moment');
var _ = require('underscore');

var authHeaders = {
	'auth': {
		'user': process.env.ASANA_AUTH_KEY,
		'pass': process.env.ASANA_PASS
	}
};

var githubHeaders = {
	'User-Agent': 'request',
	'Authorization': 'token ' + process.env.GITHUB_AUTH_KEY
};

function init (reportDate) {

	var Assignees = {
		'5156862284278': {
			'name': 'Anantha',
			'tasks': {
				'qa': [],
				'review': [],
				'important': [],
				'lower': [],
				'others': []
			}
		},
		'8549114501427': {
			'name': 'Dhruva',
			'tasks': {
				'qa': [],
				'review': [],
				'important': [],
				'lower': [],
				'others': []
			}
		},
		'8711029151621': {
			'name': 'Rahul',
			'tasks': {
				'qa': [],
				'review': [],
				'important': [],
				'lower': [],
				'others': []
			}
		},
		'5156862284269': {
			'name': 'Sreekanth',
			'tasks': {
				'qa': [],
				'review': [],
				'important': [],
				'lower': [],
				'others': []
			}
		}
	};

	if (reportDate) {
		var date = moment(reportDate).startOf('day').format();
	} else {
		var date = moment().startOf('day').format();
	}

	console.log('Generating report for', date);

	var promisesForTasks = _.map(Object.keys(Assignees), function(assigneeId) {
		var tasksUrl = buildTasksUrlFor(assigneeId, date);
		return fetch(tasksUrl).then(function(tasks) {
			var promisesForStories = _.map(tasks.data, function(task) {
				var storiesUrl = buildStoriesUrlFor(task.id);
				return fetch(storiesUrl).then(function(stories) {
					task.stories = stories.data.slice(-2);

					//Attempting to find which section the tasks belong to
					var sectionStory = _.find(stories.data.reverse(), function (story) {
						return /moved from/i.test(story.text);
					});

					var section = 'others';
					if (sectionStory) {
						section = getSectionFromStory(sectionStory);
					}

					Assignees[assigneeId].tasks[section].push(task)
				});
			});
			return Q.allSettled(promisesForStories);
		})
	});

	return Q.allSettled(promisesForTasks).then(function () {
		var content = createMarkdownContent(Assignees, date);
		return postGist(content, date);
	});
}

function getSectionFromStory (story) {
	var text = story.text;
	if (/to review/i.test(text)) {
		return 'review';
	} else if (/important/i.test(text)) {
		return 'important';
	} else if (/qa/i.test(text)) {
		return 'qa';
	} else if (/lower/i.text(text)) {
		return 'lower'
	} else {
		return 'others'
	}
}

function postGist (content, date) {
	var url = 'https://api.github.com/gists';
	var data = {
		"description": "Summary - " + moment(date).format('ll'),
		"public": false,
		"files": {
			"summary.md": {
				"content": content
			}
		}
	};
	return post(url, data);
}

function post (url, data) {
	var deferred = Q.defer();
	request(url, {method: 'POST', headers: githubHeaders, json: data}, function(err, response, body) {
		if (!err && response.statusCode == 201) {
			deferred.resolve(body);
		} else {
			deferred.reject(new Error(err));
		}
	});
	return deferred.promise;
}

function fetch (url) {
	var deferred = Q.defer();
	request(url, authHeaders ,function(err, response, body) {
		if (!err && response.statusCode == 200) {
			deferred.resolve(JSON.parse(body));
		} else {
			deferred.reject(new Error(err));
		}
	});
	return deferred.promise;
}

function createMarkdownContent (assignees, date) {
	var content = '## Activities for ' + moment(date).format('LL') + ' \n\n';

	function createSubStories () {
		return function (task) {
			content += '\n   - ' + task.name + ' (last modified: ' + moment(task.modified_at).format('lll') +') \n';
			_.each(task.stories, function(story) {
				content += '      - ' + story.created_by.name + ' (' + moment(story.created_at).format('lll') + '): ' + story.text + ' \n';
			});
		}
	}

	_.each(Object.keys(assignees), function(id) {
		content += '\n' + '### ' + assignees[id].name + ' \n';
		if (!_.isEmpty(assignees[id].tasks['review'])) {
			content += '\n#### In Review\n';
			_.each(assignees[id].tasks['review'], createSubStories());
		}
		if (!_.isEmpty(assignees[id].tasks['qa'])) {
			content += '\n#### In QA\n';
			_.each(assignees[id].tasks['qa'], createSubStories());
		}
		if (!_.isEmpty(assignees[id].tasks['important'])) {
			content += '\n#### Important\n';
			_.each(assignees[id].tasks['important'], createSubStories());
		}
		if (!_.isEmpty(assignees[id].tasks['lower'])) {
			content += '\n#### Low Priority\n';
			_.each(assignees[id].tasks['lower'], createSubStories());
		}
		if (!_.isEmpty(assignees[id].tasks['others'])) {
			content += '\n#### Others\n';
			_.each(assignees[id].tasks['others'], createSubStories());
		}
	});
	return content;
}

function buildStoriesUrlFor (task) {
	var baseUrl = 'https://app.asana.com/api/1.0/tasks/';
	return baseUrl + task + '/stories';
}

function buildTasksUrlFor (assignee, date) {
	var baseUrl = 'https://app.asana.com/api/1.0/tasks?';

	var pulseWorkSpace = 'workspace=2888447347144';

	var assigneeId = "&assignee=" + assignee;

	var modifiedSince = "&modified_since=" + moment(date).format();

	return baseUrl + pulseWorkSpace + assigneeId + modifiedSince;
}

module.exports.processDailySummary = init;
