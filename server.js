var fs = require('fs'),
  http = require('http'),
  multiparty = require('multiparty'),
  request = require('request'),
  express = require('express'),
  app = express(),
  stts, imagename;

//статичные файлы
app.use('/files', express.static(__dirname +'/files'));

//порт из окружения
var port = process.env.OPENSHIFT_NODEJS_PORT || 80;
  app.listen(port, function () {
    console.log('Example app listening on port 80!');
  });

  //index файл
  app.get('/', function (req, res) {
    fs.readFile('index.html', function(err, file) {
      if (err) res.end();
      res.end(file);
    });
  });
  //получение полосы прогресса
  app.get('/progress', function(req, res){
    stts = res;
  });

  //загрузка файла на сервер
  app.post('/file', function(req,res){
    uploadFile(req)
      .then(function(n) {
        return checkName(n);
      })
      .then(function(n) {
        res.end(n);
      })
      .catch(function(err) {
        res.statusCode = 500;
        res.end(err);
      });
  });

  //обработка файла
  app.get('/link', function(req, res){
    if (stts) {
      stts.end('2');
      stts = null;
    }
    if (!fs.existsSync('./files/' + imagename)) {
      res.end('NO SUCH FILE');
    }
    imagename = req.query.imagename;
    changeImage({
        'uploadfile': fs.createReadStream('./files/' + imagename),
        'imgwidth': 400,
        'imgheight': 400,
        'imgresizetype': 1,
        'filtset': 5,
        'dpiset': 0,
        'outformat': 2,
        'jpegtype': 1,
        'jpegqual': 80,
        'jpegmeta': 1
      }, 'https://www.imgonline.com.ua/resize-image-result.php', '', new RegExp(/https:\/\/.+?\.jpg/i))
      .then(function(link) {
        if (stts) {
          stts.end('3');
          stts = null;
        }
        return loadFile(link);
      })
      .then(function() {
        if (stts) {
          stts.end('4');
          stts = null;
        }
        return changeImage({
            'uploadfile': fs.createReadStream('./files/' + imagename),
            'ef-set': 10,
            'ef-set-2': 10,
            'jpeg-quality': 80
          }, 'https://www.imgonline.com.ua/grid-square-result.php',
          'http://www.imgonline.com.ua/',
          new RegExp(/download\.php\?file=.+?\.jpg/i))
      })
      .then(function(link) {
        if (stts) {
          stts.end('5');
          stts = null;
        }
        return loadFile(link);
      })
      .then(function() {
        if (stts) {
          stts.end('6');
          stts = null;
        }
        return changeImage({
            'uploadfile': fs.createReadStream('./files/' + imagename),
            'efset1': 2,
            'outformat': 2,
            'jpegtype': 1,
            'jpegqual': 85,
            'jpegmeta': 1
          },
          'https://www.imgonline.com.ua/add-effect-black-white-result.php', '',
          new RegExp(/https:\/\/.+?\.jpg/i)
        );
      })
      .then(function(link) {
        if (stts) {
          stts.end('7');
          stts = null;
        }
        return loadFile(link);
      })
      .then(function() {
        res.end();
      })
      .catch(function(err) {
        res.end('ERROR');
        console.log('ERR ', err);
      });
  });



//Логика приложения
function checkName(n) {
  imagename = n.slice(0, n.length-4) + '.jpg';
  return new Promise(function(resolve, reject) {
    if (!n.match(/\.jpg/i)) {
      changeImage({
          'uploadfile': fs.createReadStream('./files/' + n),
          'ef-set': 1,
          'ef-set-2': 1,
          'jpeg-conv-type': 1,
          'jpeg-meta': 1,
          'jpeg-quality': 92
        }, 'https://www.imgonline.com.ua/convert-result.php', '', new RegExp(/https:\/\/.+?\.jpg/i))
        .then(function(link) {
          fs.unlink('./files/'+n, function(){});
          return loadFile(link);
        })
        .then(function(){
          resolve(imagename);
        });
    } else resolve(imagename);
  })
}

function uploadFile(req) {
  return new Promise(function(resolve, reject) {
    var form = new multiparty.Form();
    form.parse(req, function(err, fields, files) {
      var path = files.uploadfile[0].path;
      var n = path.match(/[\w]+?\.[\w]{3}$/gi)[0];

      if (!n) reject('Wrong name');
      var extension = n.match(/\..{3}$/g)[0];
      var date = new Date().toString().slice(0, 24);

      n = 'image_' + date + extension;
      n = n.replace(/(:|\s)/g, '');

      fs.copyFile(path, './files/' + n, function(err) {
        if (err) reject('ERRinCOPYING');
        fs.unlink(path, function(err) {
          if (err) reject(err);
          var timer = setInterval(function() {
            if (fs.existsSync('./files/' + n)) {
              clearInterval(timer);
              resolve(n);
            }
          }, 10);
        });
      });
    });
  });
}

function changeImage(formData, url, link, regExp) {
  return new Promise(function(resolve, reject) {
    request.post({
      url: url,
      formData: formData
    }, function(err, resp, body) {
      if (err) {
        reject('ERRinREQUEST: ' + err);
      }
      link += body.match(regExp);
      if (link.length > 32) {
        resolve(link);
      } else {
        reject('ERROR! LINK WAS NOT FOUND');
      }
    });
  });
}

function loadFile(link) {
  return new Promise(function(resolve, reject) {
    request
      .get(link)
      .on('response', function(response) {
        response
          .pipe(fs.createWriteStream('./files/' + imagename))
          .on('finish', function(err) {
            if (err) reject('WHILE LOADING');
            else resolve();
          });
      });
  });

}
