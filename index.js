const env = require('node-env-file');
const execFile = require('child_process').execFile;
const slackbot = require('botkit').slackbot;
const webdriverio = require('webdriverio');
const request = require('request');
const fs = require('fs');
const youtubeSearch = require('youtube-search');

env(__dirname + '/.env');

const webdriver_config = {
  desiredCapabilities: {
    browserName: 'chrome',
    chromeOptions: {
      args: ['disable-infobars', 'start-fullscreen'],
      prefs: {'browser': {'show_fullscreen_toolbar': false}}
    }
  },
  port: '9515',
  path: '/',
  services: ['chromedriver']
};

const data_dir = __dirname + '/.data/';
const port = 8765;
const listen_types = ['ambient', 'direct_message'];
const controller = slackbot({
  clientId: process.env.client_id,
  clientSecret: process.env.client_secret,
  clientSigningSecret: process.env.client_signing_secret,
  scopes: ['bot'],
  json_file_store: data_dir + 'db/',
  rtm_receive_messages: false
});

controller.setupWebserver(port, (err, webserver) =>  {
  controller
    .createHomepageEndpoint(controller.webserver)
    .createOauthEndpoints(controller.webserver)
    .createWebhookEndpoints(controller.webserver);
});

var console_bot;
var browser = null;

controller.spawn({'token': process.env.token}, (bot) => {
  console_bot = bot;
}).startRTM();

function cl(...args) {
  console.log(...args);
  console_bot.say({
    channel: 'swansea-console',
    text: args.join(' ')
  });
}

function close() {
  cl('killall Chrome');
  browser = null;
  execFile('killall', ['Google Chrome']);
}

function browse(url) {
  cl('opening', url);
  if (!browser) {
    cl('starting browser');
    browser = webdriverio.remote(webdriver_config).init();
  }

  return browser.url(url);
}

function browse_youtube(url) {
  browse(url).click('.ytp-fullscreen-button');
}

function browse_image(url) {
  cl('opening image', url);
  browse('file://'+ __dirname + '/index.html').execute((url) => {
    document.getElementById("swansea-image").src = url;
  }, url);
}

controller.hears('^help$', listen_types, (bot, msg) => {
  var help = [
    'Try the following:',
    '*say <something>*, *say -v <Whisper, Zarvox, ...> <something>*, *mondd <valami>* for robo speak',
    'or just insert any link (websites, youtube etc)',
    'use */giphy <keyword>* to send gifs',
    'and */imgflip <meme>* to generate yur own memes (type _/imgflip help_)',
    '*yt <search term>* to search for youtube videos',
    '*close* kill the browser',
    '*vb* to start the World Championship stream'
  ];
  bot.reply(msg, help.join('\n'));
});

controller.hears(['^(say) (-v) (.*?) (.*)', '^(say) (.*)', '^(mondd) (.*)'], listen_types, (bot, msg) => {
  var voice = 'Fiona';
  message = msg.match[2];

  if (msg.match[1] == 'mondd') {
    voice = 'Mariska';
  } else if (msg.match[2] == '-v') {
    voice = msg.match[3];
    message = msg.match[4];
  }

  cl('saying', message, 'on', voice);
  execFile('say', ['-v', voice, message]);
});

controller.hears('^mond ', listen_types, (bot, msg) => {
  bot.reply(msg, 'you mean *mondd* :grammarnazi:')
});

controller.hears('^vol ([\\d]+)$', listen_types, (bot, msg) => {
  volume = parseInt(msg.match[1]);
  volume = Math.min(Math.max(volume, 0), 10);
  cl('set volume', volume);
  execFile('osascript', ['-e', 'set Volume '+ volume]);
});

controller.hears('^<(http.*)>$', listen_types, (bot, msg) => {
  var url = msg.match[1];
  if (url.match(/youtube/i)) {
    browse_youtube(url);
  } else {
    browse(url);
  }
});

controller.hears(['^close$', '^exit$', '^stop$'], listen_types, (bot, msg) => {
  close();
});

controller.hears('^vb$', listen_types, (bot, msg) => {
  browse('https://player.mediaklikk.hu/playernew/player.php?video=mtv4live&osfamily=OS%20X&browsername=Chrome')
    .click('#player').click('.jw-icon-fullscreen');
});

controller.hears(['^yt (.*)', '^youtube (.*)'], listen_types, (bot, msg) => {
  var keyword = msg.match[1];
  cl('searching youtube', keyword);
  youtubeSearch(keyword, {maxResults: 1, key: process.env.youtube_api_key}, (err, results) => {
    cl('youtube result, error?', err);
    if (results && results.length > 0 && results[0].link) {
      browse_youtube(results[0].link);
    }
  });
});

controller.hears('^git pull$', listen_types, (bot, msg) => {
  cl('git pull');
  execFile('git', ['pull'], (err, stdout, stderr) => cl(stdout));
});

controller.middleware.normalize.use((bot, msg, next) => {
  if (!msg.subtype && msg.bot_id){
    msg.subtype = 'bot_message';
  }
  next();
});

controller.on('bot_message', (bot, msg) => {
  if (msg['attachments'] && msg['attachments'][0] && msg['attachments'][0].image_url) {
    var url = msg['attachments'][0].image_url;
    browse_image(url);
  }
});

controller.on('file_share', (bot, msg) => {
  var file = msg.file;
  if (msg.files && msg.files.length > 0) {
    file = msg.files[0];
  }
  var url = file.url_private;
  var filename = data_dir +'uploaded';
  cl('file shared, downloading', url);

  request({
    method: 'GET',
    url: url,
    headers: {
      Authorization: 'Bearer ' + process.env.token
    }
  }, (err, res, body) => {
    browse_image('file://'+ filename)
  }).pipe(fs.createWriteStream(filename));

});

close();
