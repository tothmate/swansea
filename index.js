const env = require('node-env-file');
const execFile = require('child_process').execFile;
const slackbot = require('botkit').slackbot;

env(__dirname + '/.env');

const data_dir = __dirname + '/.data/'

const bot_options = {
  clientId: process.env.clientId,
  clientSecret: process.env.clientSecret,
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

function browse(url) {
  // TODO: implement browser open in fullscreen
  // TODO: if image, fit to screen
}

function play(filename) {
  playing = true;
  execFile('mpv', ['--fs', filename], {'cwd': data_dir}, (err, stdout, stderr) => {
    playing = false;
    next();
  });
}

function queue(url) {
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
  if (playing) {
    execFile('killall', ['mpv'], {}, (err, stdout, stderr) => next);
    return;
  }

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
  // TODO: up/down feature too
  execFile('osascript', ['-e', 'set Volume '+ volume]);
});

controller.hears('^http[^ ]*$', listen_types, (bot, msg) => {
  // TODO: does not match
  var url = msg.match[1];
  if (url.match(/youtube/i)) {
    queue(url);
  } else {
    browse(url);
  }
});

controller.hears(['^close$', '^exit$', '^clear$', '^stop$'], listen_types, (bot, msg) => {
  playlist = [];
  playing = false;
  execFile('killall', ['mpv', 'Safari']);
});

controller.hears('^next$', listen_types, (bot, msg) => {
  next();
});

controller.hears('^help$', listen_types, (bot, msg) => {
  // TODO: reply with available features
});

controller.hears('^vb$', listen_types, (bot, msg) => {
  browse('https://player.mediaklikk.hu/playernew/player.php?video=mtv4live&osfamily=OS%20X&browsername=Safari');
  // TODO: fullscreen
});

controller.hears('^gif (.*)', listen_types, (bot, msg) => {
  // TODO: giphy + fullscreen
  // TODO: keyword search
});

controller.hears(['^yt (.*)', '^youtube (.*)'], listen_types, (bot, msg) => {
  queue('ytsearch:'+ msg.match[1]);
});

// TODO: add meme subtitles
