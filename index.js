const env = require('node-env-file');
const spawn = require('child_process').spawn;
const slackbot = require('botkit').slackbot;

env(__dirname + '/.env');

const bot_options = {
  clientId: process.env.clientId,
  clientSecret: process.env.clientSecret,
  scopes: ['bot'],
  json_file_store: __dirname + '/.data/db/'
};

const controller = slackbot(bot_options);

controller.setupWebserver(process.env.port, (err, webserver) =>  {
  controller
    .createHomepageEndpoint(controller.webserver)
    .createOauthEndpoints(controller.webserver)
    .createWebhookEndpoints(controller.webserver);
});

const listen_types = ['ambient', 'direct_message'];

function say(voice, message) {
  console.log('saying', message, 'on voice', voice);
  spawn('say', ['-v', voice, message]);
}

function vol(volume) {
  console.log('setting volume to', volume);
}

function browse(url) {
  console.log('opening', url);
}

function close() {
  console.log('close');
}

function queue(url) {
  console.log('queuing', url);
}

function next() {
  console.log('next video');
}

function help() {
  console.log('help');
}

function gif(keyword) {
  console.log('showing gif', keyword);
}

controller.hears(['^(say) (-v) (.*?) (.*)', '^(say) (.*)', '^(mondd) (.*)'], listen_types, (bot, msg) => {
  var voice = 'Fiona';
  message = msg.match[2];

  if (msg.match[1] == 'mondd') {
    voice = 'Mariska';
  } else if (msg.match[2] == '-v') {
    voice = msg.match[3];
    message = msg.match[4];
  }

  say(voice, message);
});

controller.hears('^vol ([\\d]+)$', listen_types, (bot, msg) => {
  volume = parseInt(msg.match[1]);
  volume = Math.min(Math.max(volume, 0), 100);
  vol(volume);
});

controller.hears('^http[^ ]*$', listen_types, (bot, msg) => {
  var url = msg.match[1];
  if (url.match(/youtube/i)) {
    queue(url);
  } else {
    browse(url);
  }
});

controller.hears(['^close', '^exit'], listen_types, (bot, msg) => {
  close();
});

controller.hears('^next$', listen_types, (bot, msg) => {
  next();
});

controller.hears('^help$', listen_types, (bot, msg) => {
  help();
});

controller.hears('^gif (.*)', listen_types, (bot, msg) => {
  gif(msg.match[1]);
});
