const env = require('node-env-file');
const execFile = require('child_process').execFile;
const slackbot = require('botkit').slackbot;

env(__dirname + '/.env');

const data_dir = __dirname + '/.data/';
const port = 8765;
const listen_types = ['ambient', 'direct_message'];
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

function run_after_document_loaded(callback) {
  cl('checking if document ready');
  execFile('chrome-cli', ['execute', 'document.readyState'], (err, stdout, stderr) => {
    if (stdout.trim() == 'complete') {
      callback();
    } else {
      setTimeout(()=>run_after_document_loaded(callback), 1000);
    }
  });
}

function browse(url, script) {
  cl('opening url', url);
  execFile('open', ['/Applications/Google Chrome.app', '--args', '--kiosk', url]);
  if (script) {
    run_after_document_loaded(() => {
      cl('running script', script);
      execFile('chrome-cli', ['execute', script]);
    });
  }
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
    'vol <number> (does not work with hdmi)',
    'http links',
    'youtube link, yt <something>, youtube <something>',
    'next',
    'close, exit, clear',
    '/giphy <keyword>',
    '/imgflip <meme> (type _/imgflip help_ for memes)',
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
  execFile('killall', ['mpv', 'Google Chrome']);
});

controller.hears('^next$', listen_types, (bot, msg) => {
  next();
});

controller.hears('^vb$', listen_types, (bot, msg) => {
  browse('https://player.mediaklikk.hu/playernew/player.php?video=mtv4live&osfamily=OS%20X&browsername=Chrome', 'window.location.assign(\'javascript:jwplayer(\"player\").play()\')');
});

controller.hears(['^yt (.*)', '^youtube (.*)'], listen_types, (bot, msg) => {
  queue_youtube('ytsearch:'+ msg.match[1]);
});

controller.hears('^git pull$', listen_types, (bot, msg) => {
  cl('git pull');
  execFile('git', ['pull'], (err, stdout, stderr) => cl(stdout));
});

controller.middleware.normalize.use(function(bot, msg, next) {
  if (!msg.subtype && msg.bot_id){
    msg.subtype = 'bot_message';
  }
  next();
});

controller.on('bot_message', (bot, msg) => {
  if (msg['attachments'] && msg['attachments'][0] && msg['attachments'][0].image_url) {
    var url = msg['attachments'][0].image_url;
    browse('file://'+ __dirname + '/index.html', 'document.getElementById("swansea-image").src="'+ url +'";');
  }
});
