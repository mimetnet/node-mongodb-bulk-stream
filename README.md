#mongodb-bulk-stream

[![Greenkeeper badge](https://badges.greenkeeper.io/mimetnet/node-mongodb-bulk-stream.svg)](https://greenkeeper.io/)

Pipe a stream of objects for bulk update/insert into [MongoDB](//mongodb.github.io/node-mongodb-native/)


## Usage

```js
var pump = require('pump');
var count = require('count-stream');
var bulk = require('mongodb-bulk-stream');
var reloadZip = require('../lib/ReloadZipTransform');
var PackageProvider = require('../lib/PackageProvider');
var dao = new PackageProvider();

dao.open(function(error, collection, db) {
    var pkgs = dao.streamAll();

    pump(pkgs, reloadZip(db), bulk(collection), count(function(res) {
        console.log('Updated:', res);
    }), function(error) {
        if (error)
            console.error(error.toJSON());

        dao.close(true, function() {
            process.exit();
        });
    }).resume();
});
```


## API

Coming Soon


##Install

```sh
npm install mongodb-bulk-stream
```


## License

[MIT License](https://github.com/mimetnet/node-mongodb-bulk-stream/blob/master/LICENSE)
