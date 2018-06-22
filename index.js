const env = require('node-env-file');
const execFile = require('child_process').execFile;
const slackbot = require('botkit').slackbot;
const giphy_api = require('giphy-js-sdk-core');

env(__dirname + '/.env');

const data_dir = __dirname + '/.data/'

const bot_options = {
  clientId: process.env.client_id,
  clientSecret: process.env.client_secret,
  scopes: ['bot'],
  json_file_store: data_dir + 'db/'
};

const controller = slackbot(bot_options);

controller.setupWebserver(process.env.port, (err, webserver) =>  {
  controller
    .createHomepageEndpoint(controller.webserver)
    .createOauthEndpoints(controller.webserver)
    .createWebhookEndpoints(controller.webserver);
});

const listen_types = ['ambient', 'direct_message'];

var playlist = [];
var playing = false;

const giphy = giphy_api(process.env.giphy_api_key);

function browse(url) {
  execFile('open', ['/Applications/Google Chrome.app', '--args', '--kiosk', url]);
}

function play(filename, loop=false) {
  execFile('killall', ['mpv'], {}, (err, stdout, stderr) => {
    playing = true;
    var params = ['--fs', filename];
    if (loop) {
      params.unshift('--loop=inf');
    }
    execFile('mpv', params, {'cwd': data_dir}, (err, stdout, stderr) => {
      playing = false;
      next();
    });
  });
}

function queue_youtube(url) {
  execFile('youtube-dl', ['--id', '-f', 'mp4', url], {'cwd': data_dir}, (err, stdout, stderr) => {
    execFile('youtube-dl', ['--get-filename', '--id', '-f', 'mp4', url], {}, (err, stdout, stderr) => {
      playlist.push(stdout.trim());
      if (!playing) {
        next();
      }
    });
  });
}

function next() {
  if (playlist.length > 0) {
    play(playlist.shift());
  }
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

  execFile('say', ['-v', voice, message]);
});

controller.hears('^vol ([\\d]+)$', listen_types, (bot, msg) => {
  volume = parseInt(msg.match[1]);
  volume = Math.min(Math.max(volume, 0), 10);
  execFile('osascript', ['-e', 'set Volume '+ volume]);
});

controller.hears('^<(http.*)>$', listen_types, (bot, msg) => {
  var url = msg.match[1];
  if (url.match(/youtube/i)) {
    queue_youtube(url);
  } else {
    browse(url);
  }
});

controller.hears(['^close$', '^exit$', '^clear$', '^stop$'], listen_types, (bot, msg) => {
  playlist = [];
  playing = false;
  execFile('killall', ['mpv', 'Chrome']);
});

controller.hears('^next$', listen_types, (bot, msg) => {
  next();
});

controller.hears('^help$', listen_types, (bot, msg) => {
  bot.reply();
  // TODO
});

controller.hears('^vb$', listen_types, (bot, msg) => {
  browse('https://player.mediaklikk.hu/playernew/player.php?video=mtv4live&osfamily=OS%20X&browsername=Safari');
  // TODO
});

controller.hears('^gif (.*)', listen_types, (bot, msg) => {
  var keyword = msg.match[1];
  giphy.search('gifs', {'q': keyword}).then((response) => {
    if (response.data.length > 0) {
      var gif = response.data[Math.floor(Math.random()*response.data.length)];
      play(gif.images.original.mp4_url, true);
    }
  });
});

controller.hears(['^yt (.*)', '^youtube (.*)'], listen_types, (bot, msg) => {
  queue_youtube('ytsearch:'+ msg.match[1]);
});
