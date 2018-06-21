const env = require('node-env-file');

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
