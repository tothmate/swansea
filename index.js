const env = require('node-env-file');
const exec = require('child_process');

env(__dirname + '/.env');

var Botkit = require('botkit');

var bot_options = {
  clientId: process.env.clientId,
  clientSecret: process.env.clientSecret,
  scopes: ['bot'],
  json_file_store: __dirname + '/.data/db/'
};

var controller = Botkit.slackbot(bot_options);

controller.setupWebserver(process.env.port,function(err,webserver) {
  controller
    .createHomepageEndpoint(controller.webserver)
    .createOauthEndpoints(controller.webserver)
    .createWebhookEndpoints(controller.webserver);
});

listen_types = ['ambient', 'direct_message'];

function say(voice, message) {
  console.log('saying', message, 'on voice', voice);
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

controller.hears('^help$', listen_types, (bot, msg) => {
  help();
});
