const env = require('node-env-file');
const execFile = require('child_process').execFile;
const slackbot = require('botkit').slackbot;
const giphy_api = require('giphy-js-sdk-core');

env(__dirname + '/.env');

const data_dir = __dirname + '/.data/';
const port = 8765;
const listen_types = ['ambient'];
const giphy = giphy_api(process.env.giphy_api_key);
const controller = slackbot({
  clientId: process.env.client_id,
  clientSecret: process.env.client_secret,
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

controller.spawn({'token': process.env.token}, function(bot) {
  console_bot = bot;
}).startRTM();

var playlist = [];
var playing = false;

function cl(...args) {
  console.log(...args);
  console_bot.say({
    channel: 'swansea-console',
    text: args.join(' ')
  });
}

function browse(url) {
  cl('opening url', url);
  execFile('open', ['/Applications/Google Chrome.app', '--args', '--kiosk', url]);
}

function play(filename, loop=false) {
  cl('killing mpv');
  execFile('killall', ['mpv'], {}, (err, stdout, stderr) => {
    cl('playing', filename, 'looping:', loop);
    playing = true;
    var params = ['--fs', filename];
    if (loop) {
      params.unshift('--loop=inf');
    }
    execFile('mpv', params, {'cwd': data_dir}, (err, stdout, stderr) => {
      cl('mpv exited', filename);
      playing = false;
      next();
    });
  });
}

function queue_youtube(url) {
  cl('queuing youtube', url);
  execFile('youtube-dl', ['--id', '-f', 'mp4', url], {'cwd': data_dir}, (err, stdout, stderr) => {
    cl('youtube video downloaded', url);
    execFile('youtube-dl', ['--get-filename', '--id', '-f', 'mp4', url], {}, (err, stdout, stderr) => {
      cl('getting dowloaded filename', url);
      playlist.push(stdout.trim());
      if (!playing) {
        next();
      }
    });
  });
}

function next() {
  cl('next');
  if (playlist.length > 0) {
    play(playlist.shift());
  }
}

controller.hears('^help$', listen_types, (bot, msg) => {
  var help = [
    'Try the following:',
    'help',
    'say <something>, say -v <Whisper, Zarvox, ...> <something>, mondd <valami>: ',
    'vol <number>',
    'http links',
    'youtube link, yt <something>, youtube <something>',
    'next',
    'close, exit, clear',
    'gif <keyword>',
    'vb'
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

controller.hears('^vol ([\\d]+)$', listen_types, (bot, msg) => {
  volume = parseInt(msg.match[1]);
  volume = Math.min(Math.max(volume, 0), 10);
  cl('set volume', volume);
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
  cl('kill everything');
  execFile('killall', ['mpv', 'Chrome']);
});

controller.hears('^next$', listen_types, (bot, msg) => {
  next();
});

controller.hears('^vb$', ['direct_message'], (bot, msg) => {
  browse('https://player.mediaklikk.hu/playernew/player.php?video=mtv4live&osfamily=OS%20X&browsername=Chrome');
  execFile('chrome-cli', ['execute', 'window.location.assign(\'javascript:jwplayer(\"player\").play()\')']);
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
